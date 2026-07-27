#!/usr/bin/env bun
import {parseCliArgs} from './utils/cli-args.js';
import {resolveAIConfig} from './utils/AIConfig.js';
import {getConfigDir, loadDataSources} from './utils/ConfigManager.js';
import {createFileLogger, createLogHandler, getLogDir} from './utils/Logger.js';
import {
	executeQuery,
	fetchSchema,
	generateQuery,
	summarizeQueryResults,
} from './utils/QueryProcessor.js';
import {existsSync} from 'node:fs';

const helpText = `
		Usage
		  $ openinsight
		  $ openinsight --web
		  $ openinsight --source <name-or-id> --query <question>
		  $ openinsight paths

		Options
			--web       Start the local web UI instead of the TUI
			--claude    Use the installed Claude Code CLI instead of OpenRouter
			--verbose   Show detailed AI and database diagnostics
			--log       Write detailed AI and database diagnostics to a log file
			--source    Configured data source name or ID for a one-shot query
			--query     Natural-language question for a one-shot query
			--summary   Summarize one-shot query results (optional instruction)
			--host      Host for web mode (default: 127.0.0.1)
			--port      Port for web mode (default: 5678)
			--no-open   Do not open the browser in web mode
			--help      Show help

		Examples
		  $ OPENROUTER_KEY=your-key openinsight
		  $ openinsight --claude
		  $ openinsight --source production --query "Top customers"
		  $ openinsight --source production --query "Top customers" --summary="Focus on unusual trends"
		  $ openinsight --claude --verbose --log --source production --query "Top customers" --summary
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

const isOneShotQuery =
	flags.source !== null || flags.query !== null || flags.summary !== null;
let querySource = null;

if (isOneShotQuery) {
	if (!flags.source || !flags.query) {
		console.error(
			'OpenInsight: One-shot queries require both --source and --query.',
		);
		process.exit(1);
	}

	console.log(`Selecting data source "${flags.source}"...`);
	const sources = loadDataSources();
	querySource = sources.find(
		candidate =>
			candidate.id === flags.source || candidate.name === flags.source,
	);

	if (!querySource) {
		const available = sources.map(candidate => candidate.name).join(', ');
		console.error(
			`OpenInsight: Data source "${flags.source}" not found.${available ? ` Available sources: ${available}` : ' No data sources are configured.'}`,
		);
		process.exit(1);
	}
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
			onError: error =>
				console.warn(`OpenInsight: File logging disabled: ${error.message}`),
		});
	} catch (error) {
		console.warn(
			`OpenInsight: File logging unavailable; continuing without it: ${error.message}`,
		);
		aiConfig = {
			...aiConfig,
			diagnostics: flags.verbose,
			logging: false,
		};
	}
}

if (isOneShotQuery) {
	const log = createLogHandler({
		uiLog: flags.verbose ? message => console.error(message) : undefined,
		fileLog: fileLogger?.log,
		verbose: flags.verbose,
	});
	console.log('Loading database schema...');
	const schemaResult = await fetchSchema(
		querySource.connectionString,
		querySource.type,
	);
	if (schemaResult.error) {
		console.error(`OpenInsight: ${schemaResult.error}`);
		process.exit(1);
	}

	console.log('Generating SQL...');
	const generated = await generateQuery(
		flags.query,
		schemaResult.schema,
		aiConfig,
		[],
		log,
	);
	if (generated.error) {
		console.error(`OpenInsight: ${generated.error}`);
		process.exit(1);
	}

	console.log('Executing query...');
	const executed = await executeQuery(
		generated.sql,
		querySource.connectionString,
		schemaResult.schema,
		aiConfig,
		log,
	);
	if (executed.error) {
		console.error(`OpenInsight: ${executed.error}`);
		process.exit(1);
	}

	console.log(`SQL:\n${executed.sql}`);
	console.log(`\nResults:\n${stringifyResult(executed.data)}`);

	if (flags.summary !== null) {
		console.log('\nSummarizing results...');
		const summarized = await summarizeQueryResults(
			flags.query,
			executed.sql,
			executed.data,
			flags.summary,
			aiConfig,
			log,
		);
		if (summarized.error) {
			console.error(`OpenInsight: ${summarized.error}`);
			process.exit(1);
		}
		console.log(`\nSummary:\n${summarized.summary}`);
	}

	process.exit(0);
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

function stringifyResult(value) {
	return JSON.stringify(
		value,
		(_key, item) => (typeof item === 'bigint' ? item.toString() : item),
		2,
	);
}
