import {join} from 'node:path';
import process from 'node:process';
import appJs from './client/app.js' with {type: 'text'};
import indexHtml from './client/index.html' with {type: 'text'};
import stylesCss from './client/styles.css' with {type: 'text'};
import {
	addDataSource,
	getDataSource,
	loadDataSources,
	loadPresets,
	removeDataSource,
	removePreset,
	savePreset,
} from '../utils/ConfigManager.js';
import {
	testConnection,
	validateConnectionString,
} from '../utils/DbConnector.js';
import {
	executeQuery,
	fetchSchema,
	generateQuery,
} from '../utils/QueryProcessor.js';

const {OPENROUTER_KEY, OPENROUTER_MODEL = 'google/gemini-2.5-flash'} =
	process.env;

const schemas = new Map();
const assets = {
	'/': {body: indexHtml, contentType: 'text/html; charset=utf-8'},
	'/index.html': {body: indexHtml, contentType: 'text/html; charset=utf-8'},
	'/app.js': {body: appJs, contentType: 'text/javascript; charset=utf-8'},
	'/styles.css': {body: stylesCss, contentType: 'text/css; charset=utf-8'},
};

const json = (body, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: {'content-type': 'application/json; charset=utf-8'},
	});

const notFound = () => json({error: 'Not found'}, 404);

const publicSource = source => ({
	id: source.id,
	name: source.name,
	type: source.type,
});

const parseJson = async request => {
	try {
		return await request.json();
	} catch {
		return null;
	}
};

const getSourceOrResponse = sourceId => {
	const source = getDataSource(sourceId);
	return source || json({error: 'Data source not found'}, 404);
};

const loadSchemaForSource = async source => {
	const cached = schemas.get(source.id);
	if (cached) return {schema: cached, error: null};

	const result = await fetchSchema(source.connectionString, source.type);
	if (!result.error) {
		schemas.set(source.id, result.schema);
	}

	return result;
};

const routeApi = async (request, url) => {
	if (url.pathname === '/api/status' && request.method === 'GET') {
		return json({
			hasApiKey: Boolean(OPENROUTER_KEY),
			model: OPENROUTER_MODEL,
			configDir: join(process.cwd(), '.openinsight'),
		});
	}

	if (url.pathname === '/api/sources' && request.method === 'GET') {
		return json({sources: loadDataSources().map(publicSource)});
	}

	if (url.pathname === '/api/sources' && request.method === 'POST') {
		const body = await parseJson(request);
		const name = body?.name?.trim();
		const connectionString = body?.connectionString?.trim();

		if (!name) return json({error: 'Data source name is required'}, 400);

		const validation = validateConnectionString(connectionString);
		if (!validation.isValid) return json({error: validation.error}, 400);

		const connection = await testConnection(connectionString);
		if (!connection.success) return json({error: connection.error}, 400);

		const source = {
			id: crypto.randomUUID(),
			name,
			connectionString,
			type: validation.protocol,
		};
		const result = addDataSource(source);
		if (!result.success) return json({error: result.error}, 400);

		return json({source: publicSource(source)}, 201);
	}

	const sourceMatch = url.pathname.match(
		/^\/api\/sources\/([^/]+)(?:\/(.*))?$/,
	);
	if (sourceMatch) {
		const [, sourceId, suffix = ''] = sourceMatch;

		if (suffix === '' && request.method === 'DELETE') {
			const removed = removeDataSource(sourceId);
			schemas.delete(sourceId);
			return removed ? json({success: true}) : json({error: 'Not found'}, 404);
		}

		const source = getSourceOrResponse(sourceId);
		if (source instanceof Response) return source;

		if (suffix === 'schema' && request.method === 'GET') {
			const result = await loadSchemaForSource(source);
			if (result.error) return json({error: result.error}, 400);
			return json({schema: result.schema});
		}

		if (suffix === 'presets' && request.method === 'GET') {
			return json({presets: loadPresets(sourceId)});
		}

		if (suffix === 'presets' && request.method === 'POST') {
			const body = await parseJson(request);
			const name = body?.name?.trim();
			const sql = body?.sql?.trim();
			if (!name || !sql) return json({error: 'Name and SQL are required'}, 400);

			const result = savePreset(sourceId, {name, sql});
			if (!result.success) return json({error: result.error}, 400);
			return json({presets: loadPresets(sourceId)}, 201);
		}

		const presetMatch = suffix.match(/^presets\/([^/]+)$/);
		if (presetMatch && request.method === 'DELETE') {
			const removed = removePreset(sourceId, presetMatch[1]);
			return removed ? json({success: true}) : json({error: 'Not found'}, 404);
		}
	}

	if (url.pathname === '/api/query/generate' && request.method === 'POST') {
		const body = await parseJson(request);
		const source = getSourceOrResponse(body?.sourceId);
		if (source instanceof Response) return source;
		if (!OPENROUTER_KEY) {
			return json(
				{error: 'OPENROUTER_KEY environment variable is required'},
				400,
			);
		}

		const schemaResult = await loadSchemaForSource(source);
		if (schemaResult.error) return json({error: schemaResult.error}, 400);

		const logs = [];
		const result = await generateQuery(
			body?.query || '',
			schemaResult.schema,
			OPENROUTER_KEY,
			OPENROUTER_MODEL,
			body?.history || [],
			message => logs.push(message),
		);

		return json({...result, logs});
	}

	if (url.pathname === '/api/query/execute' && request.method === 'POST') {
		const body = await parseJson(request);
		const source = getSourceOrResponse(body?.sourceId);
		if (source instanceof Response) return source;

		const schemaResult = await loadSchemaForSource(source);
		if (schemaResult.error) return json({error: schemaResult.error}, 400);

		const logs = [];
		const result = await executeQuery(
			body?.sql || '',
			source.connectionString,
			schemaResult.schema,
			OPENROUTER_KEY,
			OPENROUTER_MODEL,
			message => logs.push(message),
		);

		return json({...result, logs});
	}

	return notFound();
};

const serveStatic = async url => {
	const asset = assets[url.pathname] || assets['/index.html'];

	return new Response(asset.body, {
		headers: {'content-type': asset.contentType},
	});
};

export function startWebServer({host = '127.0.0.1', port = 5678} = {}) {
	const server = Bun.serve({
		host,
		port,
		async fetch(request) {
			const url = new URL(request.url);

			try {
				if (url.pathname.startsWith('/api/')) {
					return await routeApi(request, url);
				}

				return serveStatic(url);
			} catch (error) {
				return json({error: error.message || 'Unexpected server error'}, 500);
			}
		},
	});

	if (host === '0.0.0.0') {
		console.warn('Warning: web mode is listening on all interfaces.');
	}

	console.log(
		`OpenInsight web running at http://${server.hostname}:${server.port}`,
	);
	console.log(`Config: ${join(process.cwd(), '.openinsight')}`);
	return server;
}
