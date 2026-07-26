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
	expect(stdout).toContain('--claude');
	expect(stdout).toContain('--verbose');
	expect(stdout).toContain('--port');
});

test('parseCliArgs applies defaults', () => {
	expect(parseCliArgs([])).toEqual({
		web: false,
		claude: false,
		verbose: false,
		host: '127.0.0.1',
		port: 5678,
		open: true,
		help: false,
	});
});

test('parseCliArgs converts port and keeps host', () => {
	expect(
		parseCliArgs(['--web', '--host', '0.0.0.0', '--port', '8080']),
	).toEqual({
		web: true,
		claude: false,
		verbose: false,
		host: '0.0.0.0',
		port: 8080,
		open: true,
		help: false,
	});
});

test('parseCliArgs ignores bare flag values that lack an argument', () => {
	expect(parseCliArgs(['--web', '--port'])).toEqual({
		web: true,
		claude: false,
		verbose: false,
		host: '127.0.0.1',
		port: 5678,
		open: true,
		help: false,
	});
	expect(parseCliArgs(['--web', '--host'])).toEqual({
		web: true,
		claude: false,
		verbose: false,
		host: '127.0.0.1',
		port: 5678,
		open: true,
		help: false,
	});
});

test('parseCliArgs disables browser launch with --no-open', () => {
	expect(parseCliArgs(['--web', '--no-open'])).toEqual({
		web: true,
		claude: false,
		verbose: false,
		host: '127.0.0.1',
		port: 5678,
		open: false,
		help: false,
	});
});

test('parseCliArgs keeps unknown flags permissive', () => {
	expect(parseCliArgs(['--unknown', 'value', '--web'])).toEqual({
		web: true,
		claude: false,
		verbose: false,
		host: '127.0.0.1',
		port: 5678,
		open: true,
		help: false,
	});
});

test('parseCliArgs enables the Claude provider', () => {
	expect(parseCliArgs(['--claude'])).toEqual({
		web: false,
		claude: true,
		verbose: false,
		host: '127.0.0.1',
		port: 5678,
		open: true,
		help: false,
	});
});

test('parseCliArgs enables verbose UI logging', () => {
	expect(parseCliArgs(['--verbose'])).toEqual({
		web: false,
		claude: false,
		verbose: true,
		host: '127.0.0.1',
		port: 5678,
		open: true,
		help: false,
	});
});
