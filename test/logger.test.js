import {expect, test} from 'bun:test';
import {
	appendFileSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {
	createFileLogger,
	createLogHandler,
	getLogDir,
} from '../source/utils/Logger.js';

test('getLogDir follows platform conventions', () => {
	expect(
		getLogDir({
			platform: 'linux',
			env: {XDG_STATE_HOME: '/state'},
			home: '/home/me',
		}),
	).toBe(join('/state', 'openinsight'));
	expect(getLogDir({platform: 'linux', env: {}, home: '/home/me'})).toBe(
		join('/home/me', '.local', 'state', 'openinsight'),
	);
	expect(
		getLogDir({
			platform: 'linux',
			env: {XDG_STATE_HOME: 'relative/state'},
			home: '/home/me',
		}),
	).toBe(join('/home/me', '.local', 'state', 'openinsight'));
	expect(getLogDir({platform: 'darwin', env: {}, home: '/Users/me'})).toBe(
		join('/Users/me', 'Library', 'Logs', 'OpenInsight'),
	);
	expect(
		getLogDir({
			platform: 'win32',
			env: {LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local'},
			home: 'C:\\Users\\me',
		}),
	).toBe(join('C:\\Users\\me\\AppData\\Local', 'OpenInsight', 'Logs'));
});

test('createFileLogger creates and appends timestamped log entries', () => {
	const directory = mkdtempSync(join(tmpdir(), 'openinsight-logger-'));
	const options = {
		platform: 'linux',
		env: {XDG_STATE_HOME: directory},
		home: directory,
		provider: 'claude',
		model: 'opus',
	};

	try {
		const first = createFileLogger(options);
		first.log('first entry');
		const second = createFileLogger(options);
		second.log('second entry');

		const content = readFileSync(first.path, 'utf8');
		expect(content).toContain('provider=claude, model=opus');
		expect(content).toContain('first entry');
		expect(content).toContain('second entry');
		expect(content).toMatch(/^\[\d{4}-\d{2}-\d{2}T/m);
		expect(content).toContain(`[pid:${process.pid}] [session:`);
		if (process.platform !== 'win32') {
			expect(statSync(first.path).mode & 0o777).toBe(0o600);
			expect(statSync(join(directory, 'openinsight')).mode & 0o777).toBe(0o700);
		}
	} finally {
		rmSync(directory, {recursive: true, force: true});
	}
});

test('createFileLogger bounds and escapes multiline entries', () => {
	const directory = mkdtempSync(join(tmpdir(), 'openinsight-logger-'));

	try {
		const logger = createFileLogger({
			platform: 'linux',
			env: {XDG_STATE_HOME: directory},
			home: directory,
		});
		logger.log(`line one\nline two ${'x'.repeat(21_000)}`);

		const lines = readFileSync(logger.path, 'utf8').trim().split('\n');
		expect(lines).toHaveLength(2);
		expect(lines[1]).toContain('line one\\nline two');
		expect(lines[1]).toContain('<truncated>');
	} finally {
		rmSync(directory, {recursive: true, force: true});
	}
});

test('createFileLogger rotates a full log to one archive', () => {
	const directory = mkdtempSync(join(tmpdir(), 'openinsight-logger-'));

	try {
		const logger = createFileLogger({
			platform: 'linux',
			env: {XDG_STATE_HOME: directory},
			home: directory,
		});
		writeFileSync(logger.path, 'x'.repeat(5 * 1024 * 1024));
		logger.log('after rotation');

		expect(readFileSync(`${logger.path}.1`, 'utf8')).toStartWith('xxx');
		expect(readFileSync(logger.path, 'utf8')).toContain('after rotation');
	} finally {
		rmSync(directory, {recursive: true, force: true});
	}
});

test('createFileLogger disables itself after a write failure', () => {
	const directory = mkdtempSync(join(tmpdir(), 'openinsight-logger-'));
	const errors = [];
	let writes = 0;

	try {
		const logger = createFileLogger({
			platform: 'linux',
			env: {XDG_STATE_HOME: directory},
			home: directory,
			onError: error => errors.push(error),
			appendFile: (...args) => {
				writes += 1;
				if (writes >= 3) throw new Error('disk full');
				appendFileSync(...args);
			},
		});

		expect(() => logger.log('fails')).not.toThrow();
		expect(() => logger.log('ignored')).not.toThrow();
		expect(errors).toHaveLength(1);
		expect(errors[0].message).toBe('disk full');
		expect(writes).toBe(3);
	} finally {
		rmSync(directory, {recursive: true, force: true});
	}
});

test('createLogHandler keeps diagnostics out of a non-verbose UI', () => {
	const ui = [];
	const file = [];
	const log = createLogHandler({
		uiLog: message => ui.push(message),
		fileLog: message => file.push(message),
		verbose: false,
	});

	log('normal');
	log('diagnostic', {verbose: true});

	expect(ui).toEqual(['normal']);
	expect(file).toEqual(['normal', 'diagnostic']);
});

test('createLogHandler shows diagnostics in a verbose UI', () => {
	const ui = [];
	const log = createLogHandler({
		uiLog: message => ui.push(message),
		verbose: true,
	});

	log('diagnostic', {verbose: true});
	expect(ui).toEqual(['diagnostic']);
});
