import {test, expect} from 'bun:test';
import {
	getSlashCommandHelp,
	getSlashCommandSuggestions,
} from '../source/utils/slash-commands.js';

test('getSlashCommandHelp includes all command usage text', () => {
	const help = getSlashCommandHelp();

	expect(help).toContain('/help - Show this help');
	expect(help).toContain('/delete-source <n> - Delete data source n');
	expect(help).toContain('/sources [n] - List or switch data sources');
	expect(help).toContain('/source - Show current data source');
});

test('getSlashCommandSuggestions returns commands for slash input only', () => {
	expect(getSlashCommandSuggestions('show users')).toEqual([]);
	expect(getSlashCommandSuggestions('/').map(({command}) => command)).toContain(
		'/help',
	);
});

test('getSlashCommandSuggestions filters by command prefix', () => {
	expect(getSlashCommandSuggestions('/so').map(({command}) => command)).toEqual(
		['/sources', '/source'],
	);
});

test('getSlashCommandSuggestions ignores leading whitespace and arguments', () => {
	expect(
		getSlashCommandSuggestions('  /presets 1').map(({command}) => command),
	).toEqual(['/presets']);
});

test('getSlashCommandSuggestions includes delete source command', () => {
	expect(
		getSlashCommandSuggestions('/delete-s').map(({command}) => command),
	).toEqual(['/delete-source']);
});
