export const SLASH_COMMANDS = [
	{
		command: '/help',
		description: 'Show this help',
		usage: '/help',
	},
	{
		command: '/new',
		description: 'Start new thread',
		usage: '/new',
	},
	{
		command: '/save',
		description: 'Save last query as preset',
		usage: '/save <name>',
	},
	{
		command: '/presets',
		description: 'List or run saved presets',
		usage: '/presets [n]',
	},
	{
		command: '/delete-preset',
		description: 'Delete preset n',
		usage: '/delete-preset <n>',
	},
	{
		command: '/delete-source',
		description: 'Delete data source n',
		usage: '/delete-source <n>',
	},
	{
		command: '/add',
		description: 'Add new data source',
		usage: '/add',
	},
	{
		command: '/sources',
		description: 'List or switch data sources',
		usage: '/sources [n]',
	},
	{
		command: '/source',
		description: 'Show current data source',
		usage: '/source',
	},
	{
		command: '/schema',
		description: 'Show cached schema',
		usage: '/schema',
	},
	{
		command: '/clear',
		description: 'Clear messages',
		usage: '/clear',
	},
];

export function getSlashCommandHelp() {
	const commands = SLASH_COMMANDS.map(
		({usage, description}) => `${usage} - ${description}`,
	).join('\n');

	return `Commands:\n${commands}`;
}

export function getSlashCommandSuggestions(input) {
	const query = input.trimStart();
	if (!query.startsWith('/')) return [];

	const commandPrefix = query.split(/\s+/, 1)[0].toLowerCase();

	return SLASH_COMMANDS.filter(({command}) =>
		command.toLowerCase().startsWith(commandPrefix),
	);
}
