#!/usr/bin/env bun
import {parseCliArgs} from './utils/cli-args.js';
import {resolveAIConfig} from './utils/AIConfig.js';
import {getConfigDir} from './utils/ConfigManager.js';
import {createFileLogger, getLogDir} from './utils/Logger.js';
import {existsSync} from 'node:fs';

const helpText = `
		Usage
		  $ openinsight
		  $ openinsight --web
		  $ openinsight paths

		Options
			--web       Start the local web UI instead of the TUI
			--claude    Use the installed Claude Code CLI instead of OpenRouter
			--verbose   Show detailed AI and database diagnostics in the UI
			--log       Write detailed AI and database diagnostics to a log file
			--host      Host for web mode (default: 127.0.0.1)
			--port      Port for web mode (default: 5678)
			--no-open   Do not open the browser in web mode
			--help      Show help

		Examples
		  $ OPENROUTER_KEY=your-key openinsight
		  $ openinsight --claude
		  $ OPENROUTER_KEY=your-key openinsight --web
	`;

const flags = parseCliArgs();

if (flags.help) {
	console.log(helpText);
	process.exit(0);
}

if (flags.command === 'paths') {
	console.log(`Logs: ${getLogDir()}`);
	const configDir = getConfigDir();
	if (existsSync(configDir)) console.log(`Config: ${configDir}`);
	process.exit(0);
}

let aiConfig;
try {
	aiConfig = resolveAIConfig({
		provider: flags.claude ? 'claude' : undefined,
		verbose: flags.verbose,
		diagnostics: flags.verbose || flags.log,
		logging: flags.log,
	});
} catch (error) {
	console.error(`OpenInsight: ${error.message}`);
	process.exit(1);
}

if (aiConfig.provider === 'claude' && !aiConfig.available) {
	console.error(`OpenInsight: ${aiConfig.unavailableMessage}`);
	console.error(
		'Install Claude Code and authenticate it before using --claude.',
	);
	process.exit(1);
}

let fileLogger = null;
if (flags.log) {
	try {
		fileLogger = createFileLogger({
			provider: aiConfig.provider,
			model: aiConfig.model,
		});
	} catch (error) {
		console.error(
			`OpenInsight: Failed to initialize logging: ${error.message}`,
		);
		process.exit(1);
	}
}

if (flags.web) {
	const {startWebServer} = await import('./web/server.js');
	startWebServer({
		host: flags.host,
		port: flags.port,
		open: flags.open,
		aiConfig,
		fileLog: fileLogger?.log,
	});
	await new Promise(() => {});
}

const {createCliRenderer} = await import('@opentui/core');
const {createRoot} = await import('@opentui/react');
const {default: App} = await import('./app.js');

const renderer = await createCliRenderer({
	exitOnCtrlC: false,
	useMouse: true,
	enableMouseMovement: true,
});

let hasExited = false;

const exit = () => {
	if (hasExited) return;
	hasExited = true;
	root.unmount();
	renderer.destroy();
	process.exit(0);
};

const root = createRoot(renderer);
root.render(
	<App aiConfig={aiConfig} fileLog={fileLogger?.log} onRequestQuit={exit} />,
);

process.on('SIGINT', exit);
process.on('SIGTERM', exit);
