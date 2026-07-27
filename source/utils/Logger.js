import {
	appendFileSync,
	chmodSync,
	existsSync,
	mkdirSync,
	renameSync,
	rmSync,
	statSync,
} from 'node:fs';
import {homedir} from 'node:os';
import {isAbsolute, join} from 'node:path';
import process from 'node:process';
import {APP_VERSION} from './version.js';

const MAX_ENTRY_LENGTH = 20_000;
const MAX_LOG_SIZE = 5 * 1024 * 1024;

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

	const stateHome = isAbsolute(env.XDG_STATE_HOME || '')
		? env.XDG_STATE_HOME
		: join(home, '.local', 'state');
	return join(stateHome, 'openinsight');
}

export function createFileLogger({
	provider,
	model,
	onError,
	appendFile = appendFileSync,
	...pathOptions
} = {}) {
	const platform = pathOptions.platform || process.platform;
	const directory = getLogDir(pathOptions);
	const path = join(directory, 'openinsight.log');
	const archivePath = `${path}.1`;
	const session = crypto.randomUUID();
	let enabled = true;
	mkdirSync(directory, {recursive: true});
	appendFile(path, '', {encoding: 'utf8', mode: 0o600});
	if (platform !== 'win32') {
		chmodSync(directory, 0o700);
		chmodSync(path, 0o600);
	}

	const log = message => {
		if (!enabled) return;

		try {
			const value = String(message);
			const bounded =
				value.length > MAX_ENTRY_LENGTH
					? `${value.slice(0, MAX_ENTRY_LENGTH)}… <truncated>`
					: value;
			const record = `[${new Date().toISOString()}] [pid:${process.pid}] [session:${session}] ${JSON.stringify(bounded)}\n`;

			if (
				existsSync(path) &&
				statSync(path).size + Buffer.byteLength(record) > MAX_LOG_SIZE
			) {
				rmSync(archivePath, {force: true});
				renameSync(path, archivePath);
			}

			appendFile(path, record, {encoding: 'utf8', mode: 0o600});
		} catch (error) {
			enabled = false;
			try {
				onError?.(error);
			} catch {
				// A diagnostics sink must never affect application behavior.
			}
		}
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
