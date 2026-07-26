import {parseArgs} from 'node:util';

export function parseCliArgs(args = Bun.argv.slice(2)) {
	const {values} = parseArgs({
		args,
		options: {
			web: {type: 'boolean', default: false},
			host: {type: 'string', default: '127.0.0.1'},
			port: {type: 'string', default: '5678'},
			help: {type: 'boolean', default: false},
		},
		strict: false,
		allowPositionals: true,
	});

	return {
		web: values.web === true,
		host: typeof values.host === 'string' ? values.host : '127.0.0.1',
		port: typeof values.port === 'string' ? Number(values.port) : 5678,
		help: values.help === true,
	};
}
