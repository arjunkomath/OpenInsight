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

let hasCleanedUp = false;

const cleanup = () => {
	if (hasCleanedUp) {
		return;
	}

	hasCleanedUp = true;
	process.stdout.write(leaveAltScreen);
};

const requestQuit = () => {
	unmount();
	cleanup();
	process.exit(0);
};

const {unmount, waitUntilExit} = render(<App onRequestQuit={requestQuit} />, {
	exitOnCtrlC: false,
});

process.on('exit', cleanup);
process.on('SIGINT', requestQuit);
process.on('SIGTERM', requestQuit);

waitUntilExit().then(() => {
	cleanup();
});
