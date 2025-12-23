import React, {useState} from 'react';
import {Box, Text, useStdout, useInput} from 'ink';
import {Spinner, TextInput} from '@inkjs/ui';
import Table from './Table.js';

const COMMANDS = [
	'/help',
	'/new',
	'/save',
	'/presets',
	'/delete-preset',
	'/add',
	'/sources',
	'/schema',
	'/clear',
];

export default function QueryInterface({
	source,
	sources,
	schema,
	schemaError,
	onGenerateQuery,
	onExecuteQuery,
	onSwitchSource,
	onManageSources,
	onLoadPresets,
	onSavePreset,
	onDeletePreset,
	hasApiKey,
	model,
}) {
	const [input, setInput] = useState('');
	const [inputKey, setInputKey] = useState(0);
	const [messages, setMessages] = useState(() => {
		const initial = [];
		if (schema) {
			const tableCount = Object.keys(schema).length;
			initial.push({
				role: 'log',
				content: `Schema loaded: ${tableCount} tables`,
			});
		}
		if (schemaError) {
			initial.push({role: 'error', content: `Schema error: ${schemaError}`});
		}
		return initial;
	});
	const [isProcessing, setIsProcessing] = useState(false);
	const [pendingQuery, setPendingQuery] = useState(null);
	const [lastExecutedSql, setLastExecutedSql] = useState(null);
	const {stdout} = useStdout();
	const terminalHeight = stdout?.rows || 24;

	const MAX_MESSAGES = 100;

	const addMessage = msg => {
		setMessages(prev => [...prev.slice(-MAX_MESSAGES + 1), msg]);
	};

	const addLog = message => {
		addMessage({role: 'log', content: message});
	};

	const clearInput = () => {
		setInput('');
		setInputKey(k => k + 1);
	};

	const executeConfirmedQuery = async () => {
		clearInput();
		setIsProcessing(true);
		const sql = pendingQuery.sql;
		setPendingQuery(null);
		const result = await onExecuteQuery(sql, addLog);
		setIsProcessing(false);

		if (result.error) {
			addMessage({role: 'error', content: result.error});
		} else {
			setLastExecutedSql(result.sql);
			addMessage({role: 'assistant', content: result.sql, data: result.data});
		}
	};

	const cancelPendingQuery = () => {
		clearInput();
		addMessage({role: 'system', content: 'Query cancelled'});
		setPendingQuery(null);
	};

	useInput((input, key) => {
		if (!pendingQuery || isProcessing) return;

		if (input.toLowerCase() === 'y') {
			executeConfirmedQuery();
		} else if (input.toLowerCase() === 'n' || key.escape) {
			cancelPendingQuery();
		}
	});

	const handleSubmit = async query => {
		if (!query.trim() || isProcessing) return;

		if (pendingQuery) {
			return;
		}

		addMessage({role: 'user', content: query});
		clearInput();

		if (query.startsWith('/')) {
			handleCommand(query);
			return;
		}

		if (!hasApiKey) {
			addMessage({
				role: 'error',
				content: 'OPENROUTER_KEY environment variable is required',
			});
			return;
		}

		setIsProcessing(true);

		const history = messages
			.filter(m => m.role === 'user' || m.role === 'assistant')
			.slice(-10)
			.map(m => ({
				role: m.role,
				content: m.content,
			}));

		const result = await onGenerateQuery(query, history, addLog);

		setIsProcessing(false);

		if (result.error) {
			addMessage({role: 'error', content: result.error});
			return;
		}

		setPendingQuery({sql: result.sql, query});
		addMessage({role: 'confirm', content: result.sql});
	};

	const handleCommand = command => {
		if (command === '/help') {
			addMessage({
				role: 'system',
				content:
					'Commands:\n/help - Show this help\n/new - Start new thread\n/save <name> - Save last query as preset\n/presets - List saved presets\n/presets <n> - Run preset n\n/delete-preset <n> - Delete preset n\n/add - Add new data source\n/sources - List all sources\n/sources <n> - Switch to source n\n/schema - Show cached schema\n/clear - Clear messages',
			});
		} else if (command === '/save' || command.startsWith('/save ')) {
			const name = command.slice(5).trim();
			if (!name) {
				addMessage({role: 'error', content: 'Usage: /save <name>'});
				return;
			}
			if (!lastExecutedSql) {
				addMessage({
					role: 'error',
					content: 'No query to save. Run a query first.',
				});
				return;
			}
			const result = onSavePreset({name, sql: lastExecutedSql});
			if (result.success) {
				addMessage({role: 'system', content: `Preset "${name}" saved`});
			} else {
				addMessage({role: 'error', content: result.error});
			}
		} else if (command.startsWith('/presets')) {
			const parts = command.split(' ');
			const presets = onLoadPresets();
			if (parts.length === 1) {
				if (presets.length === 0) {
					addMessage({
						role: 'system',
						content:
							'No presets saved. Use /save <name> after running a query.',
					});
				} else {
					const list = presets.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
					addMessage({
						role: 'system',
						content: `Presets:\n${list}\n\nUse /presets <n> to run`,
					});
				}
			} else {
				const idx = parseInt(parts[1], 10) - 1;
				if (idx >= 0 && idx < presets.length) {
					const preset = presets[idx];
					setPendingQuery({sql: preset.sql, query: preset.name});
					addMessage({role: 'confirm', content: preset.sql});
				} else {
					addMessage({
						role: 'error',
						content: `Invalid preset number. Use 1-${presets.length}`,
					});
				}
			}
		} else if (
			command === '/delete-preset' ||
			command.startsWith('/delete-preset ')
		) {
			const parts = command.split(' ');
			const presets = onLoadPresets();
			if (parts.length === 1) {
				addMessage({role: 'error', content: 'Usage: /delete-preset <n>'});
			} else {
				const idx = parseInt(parts[1], 10) - 1;
				if (idx >= 0 && idx < presets.length) {
					const preset = presets[idx];
					const result = onDeletePreset(preset.id);
					if (result) {
						addMessage({
							role: 'system',
							content: `Preset "${preset.name}" deleted`,
						});
					} else {
						addMessage({role: 'error', content: 'Failed to delete preset'});
					}
				} else {
					addMessage({
						role: 'error',
						content: `Invalid preset number. Use 1-${presets.length}`,
					});
				}
			}
		} else if (command.startsWith('/sources')) {
			const parts = command.split(' ');
			if (parts.length === 1) {
				const list = sources
					.map(
						(s, i) =>
							`${i + 1}. ${s.name} (${s.type})${
								s.id === source.id ? ' *' : ''
							}`,
					)
					.join('\n');
				addMessage({role: 'system', content: `Data Sources:\n${list}`});
			} else {
				const idx = parseInt(parts[1], 10) - 1;
				if (idx >= 0 && idx < sources.length) {
					onSwitchSource(sources[idx]);
				} else {
					addMessage({
						role: 'error',
						content: `Invalid source number. Use 1-${sources.length}`,
					});
				}
			}
		} else if (command === '/source') {
			addMessage({
				role: 'system',
				content: `Connected to: ${source.name} (${source.type})`,
			});
		} else if (command === '/schema') {
			if (!schema) {
				addMessage({role: 'error', content: 'No schema loaded'});
			} else {
				const tables = Object.entries(schema)
					.map(
						([table, cols]) =>
							`${table}: ${cols.map(c => c.column).join(', ')}`,
					)
					.join('\n');
				addMessage({role: 'system', content: `Tables:\n${tables}`});
			}
		} else if (command === '/clear') {
			setMessages([]);
		} else if (command === '/new') {
			setMessages([{role: 'system', content: 'New thread started'}]);
		} else if (command === '/add') {
			onManageSources();
		} else {
			addMessage({role: 'system', content: `Unknown command: ${command}`});
		}
	};

	const maxTableRows = Math.max(Math.floor((terminalHeight - 15) / 1), 3);

	const prepareTableData = data => {
		if (!data || data.length === 0) return null;

		const rows = data.slice(0, maxTableRows);
		const columns = Object.keys(data[0]);

		return rows.map(row => {
			const newRow = {};
			for (const col of columns) {
				const val = row[col];
				if (val === null || val === undefined) {
					newRow[col] = '';
				} else if (typeof val === 'object') {
					newRow[col] = JSON.stringify(val).slice(0, 20);
				} else {
					newRow[col] = String(val).slice(0, 25);
				}
			}
			return newRow;
		});
	};

	const getVisibleMessages = () => {
		const result = [];
		let lineCount = 0;
		const maxLines = terminalHeight - 5;

		for (let i = messages.length - 1; i >= 0 && lineCount < maxLines; i--) {
			const msg = messages[i];
			let msgLines = 2;
			if (msg.role === 'assistant' && msg.data?.length > 0) {
				msgLines = 5 + Math.min(msg.data.length, maxTableRows);
			} else if (msg.role === 'system') {
				msgLines = msg.content.split('\n').length;
			}
			if (lineCount + msgLines <= maxLines) {
				result.unshift(msg);
				lineCount += msgLines;
			} else {
				break;
			}
		}
		return result;
	};

	const visibleMessages = getVisibleMessages();

	return (
		<Box flexDirection="column" height={terminalHeight}>
			<Box paddingX={1}>
				<Text bold color="cyan">
					{source.name}
				</Text>
				<Text color="gray"> ({source.type})</Text>
				{!hasApiKey && <Text color="red"> [No API Key]</Text>}
			</Box>

			<Box flexDirection="column" flexGrow={1} paddingX={1}>
				{visibleMessages.map((msg, index) => (
					<Box key={index} flexDirection="column">
						{msg.role === 'user' && (
							<Box flexDirection="column">
								<Text color="cyan" bold>
									› {msg.content}
								</Text>
							</Box>
						)}
						{msg.role === 'log' && <Text color="gray">│ {msg.content}</Text>}
						{msg.role === 'assistant' && (
							<Box
								borderStyle="round"
								borderColor="gray"
								paddingX={1}
								flexDirection="column"
								marginY={1}
							>
								<Text color="gray" dimColor>
									{msg.content}
								</Text>
								{msg.data && msg.data.length > 0 && (
									<Box flexDirection="column">
										<Table data={prepareTableData(msg.data)} />
										{msg.data.length > maxTableRows && (
											<Text dimColor>
												({msg.data.length - maxTableRows} more rows)
											</Text>
										)}
									</Box>
								)}
								{msg.data && msg.data.length === 0 && (
									<Text dimColor>No results</Text>
								)}
							</Box>
						)}
						{msg.role === 'error' && <Text color="red">✗ {msg.content}</Text>}
						{msg.role === 'system' && (
							<Box flexDirection="column">
								{msg.content.split('\n').map((line, i) => (
									<Text key={i} color="yellow">
										{line}
									</Text>
								))}
							</Box>
						)}
						{msg.role === 'confirm' && (
							<Box
								borderStyle="round"
								borderColor="green"
								paddingX={1}
								flexDirection="column"
								marginY={1}
							>
								<Text color="white">{msg.content}</Text>
								<Text color="yellow" bold>
									Execute?{' '}
								</Text>
								<Text dimColor>(Y to run, N to cancel)</Text>
							</Box>
						)}
					</Box>
				))}
				{isProcessing && (
					<Box paddingLeft={1}>
						<Spinner label="Thinking..." />
					</Box>
				)}
			</Box>

			<Box
				borderStyle="single"
				borderColor={pendingQuery ? 'yellow' : 'gray'}
				paddingX={1}
				marginX={1}
				flexShrink={0}
			>
				<Text color={pendingQuery ? 'yellow' : 'cyan'}>❯ </Text>
				<TextInput
					key={inputKey}
					defaultValue=""
					onChange={value => !pendingQuery && setInput(value)}
					onSubmit={handleSubmit}
					placeholder={
						pendingQuery
							? 'Press Y to run, N to cancel'
							: 'Ask a question about your data...'
					}
					suggestions={COMMANDS}
				/>
			</Box>

			<Box paddingX={2} flexShrink={0}>
				<Text dimColor>📁 {process.cwd().split('/').pop()}</Text>
				<Text dimColor> • </Text>
				<Text color="green">● {source.name}</Text>
				<Text dimColor> • </Text>
				<Text dimColor>⚡ {model.split('/').pop()}</Text>
			</Box>
		</Box>
	);
}
