import {createConnection} from './DbConnector.js';
import {createOpenRouterClient} from './OpenRouterClient.js';
import {isAbortError, throwIfAborted} from './abort.js';

async function getSchema(conn, dbType) {
	if (dbType === 'postgres' || dbType === 'postgresql') {
		const tables = await conn.query(`
			SELECT table_name, column_name, data_type
			FROM information_schema.columns
			WHERE table_schema = 'public'
			ORDER BY table_name, ordinal_position
		`);
		return formatSchema(tables);
	}

	if (dbType === 'mysql') {
		const tables = await conn.query(`
			SELECT table_name, column_name, data_type
			FROM information_schema.columns
			WHERE table_schema = DATABASE()
			ORDER BY table_name, ordinal_position
		`);
		return formatSchema(tables);
	}

	if (dbType === 'sqlite') {
		const tableList = await conn.query(`
			SELECT name FROM sqlite_master
			WHERE type='table' AND name NOT LIKE 'sqlite_%'
		`);

		const schema = {};
		for (const {name} of tableList) {
			const columns = await conn.query(`PRAGMA table_info(${name})`);
			schema[name] = columns.map(c => ({
				column: c.name,
				type: c.type,
			}));
		}
		return schema;
	}

	return {};
}

function formatSchema(rows) {
	const schema = {};
	for (const row of rows) {
		const tableName = row.table_name;
		if (!schema[tableName]) {
			schema[tableName] = [];
		}
		schema[tableName].push({
			column: row.column_name,
			type: row.data_type,
		});
	}
	return schema;
}

export async function fetchSchema(connectionString, dbType) {
	let conn;
	try {
		conn = await createConnection(connectionString);
	} catch (error) {
		return {schema: null, error: `Failed to connect: ${error.message}`};
	}

	try {
		const schema = await getSchema(conn, dbType);
		await conn.close();
		return {schema, error: null};
	} catch (error) {
		await conn.close();
		return {schema: null, error: `Failed to fetch schema: ${error.message}`};
	}
}

export async function generateQuery(
	naturalLanguageQuery,
	schema,
	openRouterKey,
	model,
	history,
	onLog,
	abortSignal,
) {
	const log = message => {
		if (onLog) onLog(message);
	};

	if (!openRouterKey) {
		return {
			error: 'OPENROUTER_KEY environment variable is required',
			sql: null,
		};
	}

	const tableCount = Object.keys(schema).length;
	log(`Using cached schema (${tableCount} tables)`);

	try {
		throwIfAborted(abortSignal, 'Inference cancelled');

		const aiClient = createOpenRouterClient(openRouterKey, model, log);
		log('Generating SQL with AI...');
		const result = await aiClient.generateSQL(
			naturalLanguageQuery,
			schema,
			history || [],
			abortSignal,
		);

		throwIfAborted(abortSignal, 'Inference cancelled');

		if (result.error) {
			return {error: result.error, sql: null};
		}

		const sql = result.sql;

		if (!isReadOnlyQuery(sql)) {
			return {error: 'Only SELECT queries are allowed', sql};
		}

		return {error: null, sql};
	} catch (error) {
		if (isAbortError(error)) {
			log('Inference cancelled');
			return {cancelled: true, error: null, sql: null};
		}

		return {
			error: error.message || 'Unexpected error while generating SQL',
			sql: null,
		};
	}
}

export async function executeQuery(
	sqlQuery,
	connectionString,
	schema,
	openRouterKey,
	model,
	onLog,
	abortSignal,
) {
	const log = message => {
		if (onLog) onLog(message);
	};

	const maxRetries = 3;
	let currentSql = sqlQuery;
	let lastError = null;
	const aiClient = createOpenRouterClient(openRouterKey, model, log);

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		let conn;
		try {
			throwIfAborted(abortSignal, 'Query execution cancelled');

			if (attempt > 1) {
				log(`Attempt ${attempt}/${maxRetries}: Fixing SQL...`);
				const result = await aiClient.fixSQL(
					currentSql,
					lastError,
					schema,
					abortSignal,
				);
				if (result.error) {
					return {error: result.error, sql: currentSql, data: null};
				}

				currentSql = result.sql;

				if (!isReadOnlyQuery(currentSql)) {
					return {
						error: 'Only SELECT queries are allowed',
						sql: currentSql,
						data: null,
					};
				}
			}

			conn = await createConnection(connectionString);
			throwIfAborted(abortSignal, 'Query execution cancelled');

			log('Executing query...');
			const data = await conn.query(currentSql, {abortSignal});
			throwIfAborted(abortSignal, 'Query execution cancelled');
			const rows = [...data];
			log(`Query returned ${rows.length} rows`);
			await conn.close();
			return {error: null, sql: currentSql, data: rows};
		} catch (error) {
			if (conn) {
				await conn.close().catch(() => {});
			}

			if (isAbortError(error)) {
				log('Query execution cancelled');
				return {cancelled: true, error: null, sql: currentSql, data: null};
			}

			if (!conn) {
				return {
					error: `Failed to connect: ${error.message}`,
					sql: currentSql,
					data: null,
				};
			}

			lastError = error.message;
			log(`Query error: ${lastError}`);
			if (attempt === maxRetries) {
				return {
					error: `Query failed after ${maxRetries} attempts: ${lastError}`,
					sql: currentSql,
					data: null,
				};
			}
		}
	}

	return {error: 'Unexpected error', sql: currentSql, data: null};
}

function isReadOnlyQuery(sql) {
	const normalized = sql.toUpperCase().replace(/\s+/g, ' ').trim();

	if (sql.includes(';')) {
		const parts = sql.split(';').filter(p => p.trim());
		if (parts.length > 1) return false;
	}

	const dangerousKeywords = [
		'INSERT',
		'UPDATE',
		'DELETE',
		'DROP',
		'ALTER',
		'CREATE',
		'TRUNCATE',
		'REPLACE',
		'GRANT',
		'REVOKE',
		'EXEC',
		'EXECUTE',
		'CALL',
		'PRAGMA',
		'ATTACH',
		'DETACH',
		'VACUUM',
	];

	for (const keyword of dangerousKeywords) {
		const regex = new RegExp(`\\b${keyword}\\b`, 'i');
		if (regex.test(sql)) return false;
	}

	return normalized.startsWith('SELECT') || normalized.startsWith('WITH');
}
