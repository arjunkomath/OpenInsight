import {SQL} from 'bun';

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

export async function testConnection(connectionString) {
	const validation = validateConnectionString(connectionString);
	if (!validation.isValid) {
		return {success: false, error: validation.error};
	}

	try {
		const sql = new SQL(connectionString);
		await sql`SELECT 1`;
		await sql.close();
		return {success: true};
	} catch (error) {
		return {
			success: false,
			error: error.message || 'Failed to connect to database',
		};
	}
}

export function createConnection(connectionString) {
	const validation = validateConnectionString(connectionString);
	if (!validation.isValid) {
		throw new Error(validation.error);
	}

	return new SQL(connectionString);
}
