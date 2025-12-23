#!/usr/bin/env node
import React from 'react';
import {render} from 'ink';
import meow from 'meow';
import App from './app.js';

const enterAltScreen = '\x1b[?1049h';
const leaveAltScreen = '\x1b[?1049l';

meow(
	`
		Usage
		  $ openinsight

		Options
			--help  Show help

		Examples
		  $ OPENROUTER_KEY=your-key openinsight
	`,
	{
		importMeta: import.meta,
	},
);

process.stdout.write(enterAltScreen);
process.stdout.write('\x1b[H');

const {unmount, waitUntilExit} = render(<App />, {exitOnCtrlC: true});

const cleanup = () => {
	process.stdout.write(leaveAltScreen);
};

process.on('exit', cleanup);
process.on('SIGINT', () => {
	unmount();
	cleanup();
	process.exit(0);
});
process.on('SIGTERM', () => {
	unmount();
	cleanup();
	process.exit(0);
});

waitUntilExit().then(() => {
	cleanup();
});
