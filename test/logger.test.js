import {expect, test} from 'bun:test';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
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
