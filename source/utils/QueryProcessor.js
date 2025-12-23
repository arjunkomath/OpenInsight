import {createConnection, parseConnectionString} from './DbConnector.js';
import {createOpenRouterClient} from './OpenRouterClient.js';

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

	const aiClient = createOpenRouterClient(openRouterKey, model, log);
	log('Generating SQL with AI...');
	const result = await aiClient.generateSQL(
		naturalLanguageQuery,
		schema,
		history || [],
	);

	if (result.error) {
		return {error: result.error, sql: null};
	}

	const sql = cleanSqlResponse(result.sql);

	if (!isReadOnlyQuery(sql)) {
		return {error: 'Only SELECT queries are allowed', sql};
	}

	return {error: null, sql};
}

export async function executeQuery(
	sqlQuery,
	connectionString,
	schema,
	openRouterKey,
	model,
	onLog,
) {
	const log = message => {
		if (onLog) onLog(message);
	};

	const aiClient = createOpenRouterClient(openRouterKey, model, log);
	const maxRetries = 3;
	let currentSql = sqlQuery;
	let lastError = null;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		if (attempt > 1) {
			log(`Attempt ${attempt}/${maxRetries}: Fixing SQL...`);
			const result = await aiClient.fixSQL(currentSql, lastError, schema);
			if (result.error) {
				return {error: result.error, sql: currentSql, data: null};
			}
			currentSql = cleanSqlResponse(result.sql);

			if (!isReadOnlyQuery(currentSql)) {
				return {
					error: 'Only SELECT queries are allowed',
					sql: currentSql,
					data: null,
				};
			}
		}

		let conn;
		try {
			conn = await createConnection(connectionString);
		} catch (error) {
			return {
				error: `Failed to connect: ${error.message}`,
				sql: currentSql,
				data: null,
			};
		}

		try {
			log('Executing query...');
			const data = await conn.query(currentSql);
			const rows = Array.from(data);
			log(`Query returned ${rows.length} rows`);
			await conn.close();
			return {error: null, sql: currentSql, data: rows};
		} catch (error) {
			await conn.close();
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

function cleanSqlResponse(sql) {
	let cleaned = sql.trim();
	if (cleaned.startsWith('```sql')) {
		cleaned = cleaned.slice(6);
	} else if (cleaned.startsWith('```')) {
		cleaned = cleaned.slice(3);
	}
	if (cleaned.endsWith('```')) {
		cleaned = cleaned.slice(0, -3);
	}
	return cleaned.trim();
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
