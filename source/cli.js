#!/usr/bin/env bun
import {parseCliArgs} from './utils/cli-args.js';

const helpText = `
		Usage
		  $ openinsight
		  $ openinsight --web

		Options
			--web       Start the local web UI instead of the TUI
			--host      Host for web mode (default: 127.0.0.1)
			--port      Port for web mode (default: 5678)
			--help      Show help

		Examples
		  $ OPENROUTER_KEY=your-key openinsight
		  $ OPENROUTER_KEY=your-key openinsight --web
	`;

const flags = parseCliArgs();

if (flags.help) {
	console.log(helpText);
	process.exit(0);
}

if (flags.web) {
	const {startWebServer} = await import('./web/server.js');
	startWebServer({host: flags.host, port: flags.port});
	await new Promise(() => {});
}

const {createCliRenderer} = await import('@opentui/core');
const {createRoot} = await import('@opentui/react');
const {default: App} = await import('./app.js');

const renderer = await createCliRenderer({
	exitOnCtrlC: false,
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
root.render(<App onRequestQuit={exit} />);

process.on('SIGINT', exit);
process.on('SIGTERM', exit);
