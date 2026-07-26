#!/usr/bin/env bun
import {parseCliArgs} from './utils/cli-args.js';
import {resolveAIConfig} from './utils/AIConfig.js';

const helpText = `
		Usage
		  $ openinsight
		  $ openinsight --web

		Options
			--web       Start the local web UI instead of the TUI
			--claude    Use the installed Claude Code CLI instead of OpenRouter
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

let aiConfig;
try {
	aiConfig = resolveAIConfig({provider: flags.claude ? 'claude' : undefined});
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

if (flags.web) {
	const {startWebServer} = await import('./web/server.js');
	startWebServer({
		host: flags.host,
		port: flags.port,
		open: flags.open,
		aiConfig,
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
root.render(<App aiConfig={aiConfig} onRequestQuit={exit} />);

process.on('SIGINT', exit);
process.on('SIGTERM', exit);
