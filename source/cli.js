#!/usr/bin/env bun
import meow from 'meow';

const cli = meow(
	`
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
	`,
	{
		importMeta: import.meta,
		autoVersion: false,
		flags: {
			web: {
				type: 'boolean',
				default: false,
			},
			host: {
				type: 'string',
				default: '127.0.0.1',
			},
			port: {
				type: 'number',
				default: 5678,
			},
		},
	},
);

if (cli.flags.web) {
	const {startWebServer} = await import('./web/server.js');
	startWebServer({host: cli.flags.host, port: cli.flags.port});
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
