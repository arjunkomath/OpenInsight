import pg from 'pg';
import mysql from 'mysql2/promise';
import Database from 'better-sqlite3';

export function parseConnectionString(connectionString) {
	if (
		connectionString.startsWith('sqlite://') ||
		connectionString.startsWith('file://')
	) {
		return {
			isValid: true,
			protocol: 'sqlite',
		};
	}

	if (
		connectionString.startsWith('mysql://') ||
		connectionString.startsWith('mysql2://')
	) {
		const urlPattern =
			/^mysql2?:\/\/([^:]+):([^@]+)@([^:\/]+)(?::(\d+))?\/(.+)$/i;
		const match = connectionString.match(urlPattern);

		if (!match) {
			return {isValid: false, error: 'Invalid MySQL connection string format'};
		}

		return {
			isValid: true,
			protocol: 'mysql',
		};
	}

	if (
		connectionString.startsWith('postgres://') ||
		connectionString.startsWith('postgresql://')
	) {
		const urlPattern =
			/^(?:postgres|postgresql):\/\/([^:]+):([^@]+)@([^:\/]+)(?::(\d+))?\/(.+)$/i;
		const match = connectionString.match(urlPattern);

		if (!match) {
			return {
				isValid: false,
				error: 'Invalid PostgreSQL connection string format',
			};
		}

		return {
			isValid: true,
			protocol: 'postgres',
		};
	}

	return {
		isValid: false,
		error: 'Unsupported database type. Use postgres://, mysql://, or sqlite://',
	};
}

export function validateConnectionString(connectionString) {
	if (!connectionString || typeof connectionString !== 'string') {
		return {isValid: false, error: 'Connection string is required'};
	}

	return parseConnectionString(connectionString);
}

function getSqlitePath(connectionString) {
	if (connectionString.startsWith('sqlite://')) {
		return connectionString.slice(9);
	}
	if (connectionString.startsWith('file://')) {
		return connectionString.slice(7);
	}
	return connectionString;
}

export async function testConnection(connectionString) {
	const validation = validateConnectionString(connectionString);
	if (!validation.isValid) {
		return {success: false, error: validation.error};
	}

	try {
		if (validation.protocol === 'postgres') {
			const client = new pg.Client({connectionString});
			await client.connect();
			await client.query('SELECT 1');
			await client.end();
		} else if (validation.protocol === 'mysql') {
			const connection = await mysql.createConnection(connectionString);
			await connection.query('SELECT 1');
			await connection.end();
		} else if (validation.protocol === 'sqlite') {
			const dbPath = getSqlitePath(connectionString);
			const db = new Database(dbPath);
			db.prepare('SELECT 1').get();
			db.close();
		}
		return {success: true};
	} catch (error) {
		return {
			success: false,
			error: error.message || 'Failed to connect to database',
		};
	}
}

class PostgresConnection {
	constructor(connectionString) {
		this.client = new pg.Client({connectionString});
		this.connected = false;
	}

	async connect() {
		if (!this.connected) {
			await this.client.connect();
			this.connected = true;
		}
	}

	async query(sql) {
		await this.connect();
		const result = await this.client.query(sql);
		return result.rows;
	}

	async close() {
		if (this.connected) {
			await this.client.end();
			this.connected = false;
		}
	}
}

class MySQLConnection {
	constructor(connectionString) {
		this.connectionString = connectionString;
		this.connection = null;
	}

	async connect() {
		if (!this.connection) {
			this.connection = await mysql.createConnection(this.connectionString);
		}
	}

	async query(sql) {
		await this.connect();
		const [rows] = await this.connection.query(sql);
		return rows;
	}

	async close() {
		if (this.connection) {
			await this.connection.end();
			this.connection = null;
		}
	}
}

class SQLiteConnection {
	constructor(connectionString) {
		const dbPath = getSqlitePath(connectionString);
		this.db = new Database(dbPath);
	}

	async query(sql) {
		return this.db.prepare(sql).all();
	}

	async close() {
		this.db.close();
	}
}

export async function createConnection(connectionString) {
	const validation = validateConnectionString(connectionString);
	if (!validation.isValid) {
		throw new Error(validation.error);
	}

	if (validation.protocol === 'postgres') {
		return new PostgresConnection(connectionString);
	} else if (validation.protocol === 'mysql') {
		return new MySQLConnection(connectionString);
	} else if (validation.protocol === 'sqlite') {
		return new SQLiteConnection(connectionString);
	}

	throw new Error('Unsupported database type');
}
