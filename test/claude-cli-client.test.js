import {test, expect} from 'bun:test';
import {createClaudeCliClient} from '../source/utils/ClaudeCliClient.js';
import {isAbortError} from '../source/utils/abort.js';

const jsonResponse = payload => JSON.stringify(payload);

function fakeChild(stdout, {stderr = '', exitCode = 0} = {}) {
	return {
		stdout: new Blob([stdout]).stream(),
		stderr: new Blob([stderr]).stream(),
		exited: Promise.resolve(exitCode),
		exitCode,
		kill() {},
	};
}

test('Claude client runs an isolated structured-output request via stdin', async () => {
	let invocation;
	const spawn = (command, options) => {
		invocation = {command, options};
		return fakeChild(
			jsonResponse({
				type: 'result',
				subtype: 'success',
				is_error: false,
				structured_output: {sql: 'SELECT * FROM "users" LIMIT 1000'},
			}),
		);
	};
	const client = createClaudeCliClient('/usr/bin/claude', 'opus', null, {
		spawn,
	});

	const result = await client.generateSQL(
		'list users',
		{users: [{column: 'id', type: 'integer'}]},
		[],
	);

	expect(result).toEqual({
		sql: 'SELECT * FROM "users" LIMIT 1000',
		error: null,
	});
	expect(invocation.command[0]).toBe('/usr/bin/claude');
	expect(invocation.command).toContain('--safe-mode');
	expect(invocation.command).toContain('--json-schema');
	expect(invocation.command).toContain('--no-session-persistence');
	expect(invocation.command).toContain('mcp__*');
	const toolsIndex = invocation.command.indexOf('--tools');
	expect(invocation.command[toolsIndex + 1]).toBe('');
	expect(invocation.command.join(' ')).not.toContain('list users');
	const stdin = await invocation.options.stdin.text();
	expect(stdin).toContain('list users');
	expect(stdin).toContain('database_schema');
});

test('Claude client accepts projected result envelopes without discriminators', async () => {
	const client = createClaudeCliClient('/claude', 'opus', null, {
		spawn: () =>
			fakeChild(
				jsonResponse({
					session_id: 'session',
					structured_output: {sql: 'SELECT 1 LIMIT 1000'},
				}),
			),
	});

	expect(await client.generateSQL('q', {}, [])).toEqual({
		sql: 'SELECT 1 LIMIT 1000',
		error: null,
	});
});

test('Claude client rejects error envelopes and malformed output', async () => {
	const errorClient = createClaudeCliClient('/claude', 'opus', null, {
		spawn: () =>
			fakeChild(
				jsonResponse({
					type: 'result',
					subtype: 'error',
					is_error: true,
					result: 'Authentication required',
				}),
			),
	});
	const failedSubtypeClient = createClaudeCliClient('/claude', 'opus', null, {
		spawn: () =>
			fakeChild(
				jsonResponse({
					type: 'result',
					subtype: 'error_during_execution',
					is_error: false,
					result: 'Execution failed',
					structured_output: {sql: 'SELECT 1'},
				}),
			),
	});
	const malformedClient = createClaudeCliClient('/claude', 'opus', null, {
		spawn: () => fakeChild('not json'),
	});

	expect((await errorClient.generateSQL('q', {}, [])).error).toContain(
		'Authentication required',
	);
	expect((await failedSubtypeClient.generateSQL('q', {}, [])).error).toContain(
		'Execution failed',
	);
	expect((await malformedClient.generateSQL('q', {}, [])).error).toContain(
		'invalid JSON',
	);
});

test('Claude client rejects successful output without structured SQL', async () => {
	const client = createClaudeCliClient('/claude', 'opus', null, {
		spawn: () =>
			fakeChild(
				jsonResponse({
					type: 'result',
					subtype: 'success',
					is_error: false,
					result: '',
				}),
			),
	});

	expect((await client.generateSQL('q', {}, [])).error).toContain(
		'no structured SQL',
	);
});

test('Claude client falls back to SQL in the text result', async () => {
	const client = createClaudeCliClient('/claude', 'opus', null, {
		spawn: () =>
			fakeChild(
				jsonResponse({
					type: 'result',
					subtype: 'success',
					is_error: false,
					result: '```sql\nSELECT 1 LIMIT 1000\n```',
				}),
			),
	});

	expect(await client.generateSQL('q', {}, [])).toEqual({
		sql: 'SELECT 1 LIMIT 1000',
		error: null,
	});
});

test('Claude client includes bounded stderr for a nonzero exit', async () => {
	const client = createClaudeCliClient('/claude', 'opus', null, {
		spawn: () =>
			fakeChild('', {
				exitCode: 1,
				stderr: `Authentication failed ${'x'.repeat(3000)}`,
			}),
	});

	const result = await client.generateSQL('q', {}, []);
	expect(result.error).toContain('Claude CLI exited with code 1');
	expect(result.error).toContain('Authentication failed');
	expect(result.error.length).toBeLessThan(2100);
});

test('Claude client does not spawn for a pre-aborted request', async () => {
	const controller = new AbortController();
	controller.abort();
	let spawned = false;
	const client = createClaudeCliClient('/claude', 'opus', null, {
		spawn: () => {
			spawned = true;
			return fakeChild('');
		},
	});

	let thrown;
	try {
		await client.generateSQL('q', {}, [], controller.signal);
	} catch (error) {
		thrown = error;
	}

	expect(spawned).toBe(false);
	expect(isAbortError(thrown)).toBe(true);
});

test('Claude client terminates a running request when aborted', async () => {
	const controller = new AbortController();
	const signals = [];
	let resolveExit;
	const exited = new Promise(resolve => {
		resolveExit = resolve;
	});
	let stdoutController;
	let stderrController;
	const client = createClaudeCliClient('/claude', 'opus', null, {
		killGraceMs: 5,
		spawn: () => {
			const child = {
				stdout: new ReadableStream({
					start(streamController) {
						stdoutController = streamController;
					},
				}),
				stderr: new ReadableStream({
					start(streamController) {
						stderrController = streamController;
					},
				}),
				exited,
				exitCode: null,
				kill(signal) {
					signals.push(signal);
					this.exitCode = 143;
					stdoutController.close();
					stderrController.close();
					resolveExit(143);
				},
			};
			return child;
		},
	});

	const request = client.generateSQL('q', {}, [], controller.signal);
	controller.abort();

	let thrown;
	try {
		await request;
	} catch (error) {
		thrown = error;
	}

	expect(signals).toEqual(['SIGTERM']);
	expect(isAbortError(thrown)).toBe(true);
});

test('Claude client escalates cancellation when SIGTERM is ignored', async () => {
	const controller = new AbortController();
	const signals = [];
	let resolveExit;
	const exited = new Promise(resolve => {
		resolveExit = resolve;
	});
	let stdoutController;
	let stderrController;
	const client = createClaudeCliClient('/claude', 'opus', null, {
		killGraceMs: 1,
		spawn: () => ({
			stdout: new ReadableStream({
				start(streamController) {
					stdoutController = streamController;
				},
			}),
			stderr: new ReadableStream({
				start(streamController) {
					stderrController = streamController;
				},
			}),
			exited,
			exitCode: null,
			kill(signal) {
				signals.push(signal);
				if (signal !== 'SIGKILL') return;
				this.exitCode = 137;
				stdoutController.close();
				stderrController.close();
				resolveExit(137);
			},
		}),
	});

	const request = client.generateSQL('q', {}, [], controller.signal);
	controller.abort();

	let thrown;
	try {
		await request;
	} catch (error) {
		thrown = error;
	}

	expect(signals).toEqual(['SIGTERM', 'SIGKILL']);
	expect(isAbortError(thrown)).toBe(true);
});
