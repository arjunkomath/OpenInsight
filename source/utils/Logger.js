import {appendFileSync, chmodSync, mkdirSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import process from 'node:process';
import {APP_VERSION} from './version.js';

export function getLogDir({
	platform = process.platform,
	env = process.env,
	home = homedir(),
} = {}) {
	if (platform === 'darwin') {
		return join(home, 'Library', 'Logs', 'OpenInsight');
	}

	if (platform === 'win32') {
		return join(
			env.LOCALAPPDATA || join(home, 'AppData', 'Local'),
			'OpenInsight',
			'Logs',
		);
	}

	return join(
		env.XDG_STATE_HOME || join(home, '.local', 'state'),
		'openinsight',
	);
}

export function createFileLogger({provider, model, ...pathOptions} = {}) {
	const platform = pathOptions.platform || process.platform;
	const directory = getLogDir(pathOptions);
	const path = join(directory, 'openinsight.log');
	mkdirSync(directory, {recursive: true, mode: 0o700});
	appendFileSync(path, '', {encoding: 'utf8', mode: 0o600});
	if (platform !== 'win32') chmodSync(path, 0o600);

	const log = message => {
		appendFileSync(
			path,
			`[${new Date().toISOString()}] ${String(message)}\n`,
			'utf8',
		);
	};

	log(
		`OpenInsight ${APP_VERSION} session started (${platform}/${process.arch}, provider=${provider || 'unknown'}, model=${model || 'unknown'})`,
	);

	return {path, log};
}

export function createLogHandler({uiLog, fileLog, verbose = false} = {}) {
	return (message, options = {}) => {
		fileLog?.(message);
		if (!options.verbose || verbose) uiLog?.(message);
	};
}
