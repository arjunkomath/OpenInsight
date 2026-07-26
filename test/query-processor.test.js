import {test, expect} from 'bun:test';
import {createConnection} from '../source/utils/DbConnector.js';
import {executeQuery} from '../source/utils/QueryProcessor.js';

test('executeQuery rejects non-read-only SQL before connecting', async () => {
	const result = await executeQuery(
		'DELETE FROM users',
		'sqlite://./missing.db',
		{},
		null,
	);

	expect(result).toEqual({
		error: 'Only SELECT queries are allowed',
		sql: 'DELETE FROM users',
		data: null,
	});
});

test('executeQuery does not require AI when the first attempt succeeds', async () => {
	const path = `/tmp/openinsight-query-${crypto.randomUUID()}.db`;
	const connectionString = `sqlite://${path}`;
	const setup = await createConnection(connectionString);
	await setup.query('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)');
	await setup.query(`INSERT INTO users (name) VALUES ('ada')`);
	await setup.close();

	const result = await executeQuery(
		'SELECT name FROM users',
		connectionString,
		{},
		{
			provider: 'claude',
			available: false,
			unavailableMessage: 'Claude is unavailable',
		},
	);

	expect(result).toEqual({
		error: null,
		sql: 'SELECT name FROM users',
		data: [{name: 'ada'}],
	});
});

test('executeQuery reports when automatic repair is unavailable', async () => {
	const path = `/tmp/openinsight-query-${crypto.randomUUID()}.db`;
	const connectionString = `sqlite://${path}`;
	const setup = await createConnection(connectionString);
	await setup.query('CREATE TABLE users (id INTEGER PRIMARY KEY)');
	await setup.close();

	const result = await executeQuery(
		'SELECT missing FROM users',
		connectionString,
		{},
		{
			provider: 'claude',
			available: false,
			unavailableMessage: 'Claude is unavailable',
		},
	);

	expect(result.error).toContain('Query failed:');
	expect(result.error).toContain(
		'Automatic repair unavailable: Claude is unavailable',
	);
});
