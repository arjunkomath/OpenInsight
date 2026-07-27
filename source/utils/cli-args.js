import {parseArgs} from 'node:util';

export function parseCliArgs(args = Bun.argv.slice(2)) {
	const {values, positionals} = parseArgs({
		args,
		options: {
			web: {type: 'boolean', default: false},
			claude: {type: 'boolean', default: false},
			verbose: {type: 'boolean', default: false},
			log: {type: 'boolean', default: false},
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
		host: typeof values.host === 'string' ? values.host : '127.0.0.1',
		port: typeof values.port === 'string' ? Number(values.port) : 5678,
		open: values.open === true && values['no-open'] !== true,
		help: values.help === true,
	};
}
