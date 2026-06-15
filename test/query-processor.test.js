import {test, expect} from 'bun:test';
import {executeQuery} from '../source/utils/QueryProcessor.js';

test('executeQuery rejects non-read-only SQL before connecting', async () => {
	const result = await executeQuery(
		'DELETE FROM users',
		'sqlite://./missing.db',
		{},
		null,
		'test-model',
	);

	expect(result).toEqual({
		error: 'Only SELECT queries are allowed',
		sql: 'DELETE FROM users',
		data: null,
	});
});
