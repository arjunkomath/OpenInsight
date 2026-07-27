import {parseArgs} from 'node:util';

export function parseCliArgs(args = Bun.argv.slice(2)) {
	const normalizedArgs = args.flatMap((arg, index) =>
		arg === '--summary' &&
		(args[index + 1] === undefined ||
			args[index + 1].startsWith('-') ||
			args[index + 1] === 'paths')
			? ['--summary=']
			: [arg],
	);
	const {values, positionals} = parseArgs({
		args: normalizedArgs,
		options: {
			web: {type: 'boolean', default: false},
			claude: {type: 'boolean', default: false},
			verbose: {type: 'boolean', default: false},
			log: {type: 'boolean', default: false},
			summary: {type: 'string'},
			source: {type: 'string'},
			query: {type: 'string'},
			host: {type: 'string', default: '127.0.0.1'},
			port: {type: 'string', default: '5678'},
			open: {type: 'boolean', default: true},
			help: {type: 'boolean', default: false},
		},
		strict: false,
		allowPositionals: true,
	});

	return {
		command: positionals[0] || null,
		web: values.web === true,
		claude: values.claude === true,
		verbose: values.verbose === true,
		log: values.log === true,
		summary: typeof values.summary === 'string' ? values.summary : null,
		source: typeof values.source === 'string' ? values.source : null,
		query: typeof values.query === 'string' ? values.query : null,
		host: typeof values.host === 'string' ? values.host : '127.0.0.1',
		port: typeof values.port === 'string' ? Number(values.port) : 5678,
		open: values.open === true && values['no-open'] !== true,
		help: values.help === true,
	};
}
