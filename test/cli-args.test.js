import {test, expect} from 'bun:test';
import {spawn} from 'node:child_process';
import {parseCliArgs} from '../source/utils/cli-args.js';

const runCli = args =>
	new Promise((resolve, reject) => {
		const child = spawn('bun', ['source/cli.js', ...args], {
			cwd: new URL('..', import.meta.url).pathname,
			stdio: ['ignore', 'pipe', 'pipe'],
		});
		let stdout = '';
		let stderr = '';
		child.stdout.on('data', chunk => {
			stdout += chunk;
		});
		child.stderr.on('data', chunk => {
			stderr += chunk;
		});
		child.on('error', reject);
		child.on('close', code => resolve({code, stdout, stderr}));
	});

test('--help prints usage and exits 0', async () => {
	const {code, stdout} = await runCli(['--help']);
	expect(code).toBe(0);
	expect(stdout).toContain('Usage');
	expect(stdout).toContain('--web');
	expect(stdout).toContain('--port');
});

test('parseCliArgs applies defaults', () => {
	expect(parseCliArgs([])).toEqual({
		web: false,
		host: '127.0.0.1',
		port: 5678,
		help: false,
	});
});

test('parseCliArgs converts port and keeps host', () => {
	expect(
		parseCliArgs(['--web', '--host', '0.0.0.0', '--port', '8080']),
	).toEqual({
		web: true,
		host: '0.0.0.0',
		port: 8080,
		help: false,
	});
});

test('parseCliArgs ignores bare flag values that lack an argument', () => {
	expect(parseCliArgs(['--web', '--port'])).toEqual({
		web: true,
		host: '127.0.0.1',
		port: 5678,
		help: false,
	});
	expect(parseCliArgs(['--web', '--host'])).toEqual({
		web: true,
		host: '127.0.0.1',
		port: 5678,
		help: false,
	});
});

test('parseCliArgs keeps unknown flags permissive', () => {
	expect(parseCliArgs(['--unknown', 'value', '--web'])).toEqual({
		web: true,
		host: '127.0.0.1',
		port: 5678,
		help: false,
	});
});
