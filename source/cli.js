#!/usr/bin/env bun
import {createCliRenderer} from '@opentui/core';
import {createRoot} from '@opentui/react';
import meow from 'meow';
import App from './app.js';

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
		autoVersion: false,
	},
);

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
