import {test, expect} from 'bun:test';
import {spawn} from 'node:child_process';
import {mkdirSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseCliArgs} from '../source/utils/cli-args.js';
import {getLogDir} from '../source/utils/Logger.js';

const repositoryDir = fileURLToPath(new URL('..', import.meta.url));
const cliPath = fileURLToPath(new URL('../source/cli.js', import.meta.url));

const runCli = (args, {cwd = repositoryDir, env = process.env} = {}) =>
	new Promise((resolve, reject) => {
		const child = spawn('bun', [cliPath, ...args], {
			cwd,
			env,
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
	expect(stdout).toContain('--log');
	expect(stdout).toContain('--summary');
	expect(stdout).toContain('--port');
});

test('paths prints the platform log directory and exits 0', async () => {
	const directory = mkdtempSync(join(tmpdir(), 'openinsight-paths-'));
	mkdirSync(join(directory, '.openinsight'));

	try {
		const env = {...process.env, XDG_STATE_HOME: join(directory, 'state')};
		const {code, stdout, stderr} = await runCli(['paths'], {
			cwd: directory,
			env,
		});
		expect(code).toBe(0);
		expect(stdout).toContain(`Logs: ${getLogDir({env})}`);
		expect(stdout).toContain(`Config: ${join(directory, '.openinsight')}`);
		expect(stderr).toBe('');

		rmSync(join(directory, '.openinsight'), {recursive: true});
		const withoutConfig = await runCli(['paths'], {
			cwd: directory,
			env,
		});
		expect(withoutConfig.code).toBe(0);
		expect(withoutConfig.stdout).not.toContain('Config:');
	} finally {
		rmSync(directory, {recursive: true, force: true});
	}
});

test('parseCliArgs applies defaults', () => {
	expect(parseCliArgs([])).toEqual({
		command: null,
		web: false,
		claude: false,
		verbose: false,
		log: false,
		summary: null,
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
		command: null,
		web: true,
		claude: false,
		verbose: false,
		log: false,
		summary: null,
		host: '0.0.0.0',
		port: 8080,
		open: true,
		help: false,
	});
});

test('parseCliArgs ignores bare flag values that lack an argument', () => {
	expect(parseCliArgs(['--web', '--port'])).toEqual({
		command: null,
		web: true,
		claude: false,
		verbose: false,
		log: false,
		summary: null,
		host: '127.0.0.1',
		port: 5678,
		open: true,
		help: false,
	});
	expect(parseCliArgs(['--web', '--host'])).toEqual({
		command: null,
		web: true,
		claude: false,
		verbose: false,
		log: false,
		summary: null,
		host: '127.0.0.1',
		port: 5678,
		open: true,
		help: false,
	});
});

test('parseCliArgs disables browser launch with --no-open', () => {
	expect(parseCliArgs(['--web', '--no-open'])).toEqual({
		command: null,
		web: true,
		claude: false,
		verbose: false,
		log: false,
		summary: null,
		host: '127.0.0.1',
		port: 5678,
		open: false,
		help: false,
	});
});

test('parseCliArgs keeps unknown flags permissive', () => {
	expect(parseCliArgs(['--unknown', 'value', '--web'])).toEqual({
		command: 'value',
		web: true,
		claude: false,
		verbose: false,
		log: false,
		summary: null,
		host: '127.0.0.1',
		port: 5678,
		open: true,
		help: false,
	});
});

test('parseCliArgs enables the Claude provider', () => {
	expect(parseCliArgs(['--claude'])).toEqual({
		command: null,
		web: false,
		claude: true,
		verbose: false,
		log: false,
		summary: null,
		host: '127.0.0.1',
		port: 5678,
		open: true,
		help: false,
	});
});

test('parseCliArgs enables verbose UI logging', () => {
	expect(parseCliArgs(['--verbose'])).toEqual({
		command: null,
		web: false,
		claude: false,
		verbose: true,
		log: false,
		summary: null,
		host: '127.0.0.1',
		port: 5678,
		open: true,
		help: false,
	});
});

test('parseCliArgs enables file logging', () => {
	expect(parseCliArgs(['--log'])).toMatchObject({
		command: null,
		verbose: false,
		log: true,
	});
});

test('parseCliArgs enables summaries with an optional instruction', () => {
	expect(parseCliArgs(['--summary'])).toMatchObject({summary: ''});
	expect(parseCliArgs(['--summary', 'Focus on trends'])).toMatchObject({
		summary: 'Focus on trends',
	});
	expect(parseCliArgs(['--summary', '--verbose'])).toMatchObject({
		summary: '',
		verbose: true,
	});
});

test('parseCliArgs recognizes the paths command', () => {
	expect(parseCliArgs(['paths'])).toMatchObject({
		command: 'paths',
		verbose: false,
		log: false,
	});
});
