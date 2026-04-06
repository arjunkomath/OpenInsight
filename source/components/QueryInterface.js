import process from 'node:process';
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Box, Text, useStdout, useInput} from 'ink';
import Spinner from 'ink-spinner';
import TextInput from 'ink-text-input';
import {
	getVisibleLineWindow,
	renderTranscriptLines,
	truncateStatus,
} from '../utils/transcript.js';
import {getQueryCtrlCAction} from '../utils/query-quit.js';

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
	onRequestQuit,
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
	const [scrollTop, setScrollTop] = useState(0);
	const [autoFollow, setAutoFollow] = useState(true);
	const [pendingQuery, setPendingQuery] = useState(null);
	const [lastExecutedSql, setLastExecutedSql] = useState(null);
	const [awaitingQuitConfirmation, setAwaitingQuitConfirmation] =
		useState(false);
	const {stdout} = useStdout();
	const terminalHeight = stdout?.rows || 24;
	const terminalWidth = stdout?.columns || 80;
	const previousMetricsRef = useRef({
		lineCount: 0,
		transcriptHeight: 0,
	});

	const MAX_MESSAGES = 100;
	const reservedRows = 9;
	const transcriptHeight = Math.max(terminalHeight - reservedRows, 4);
	const transcriptWidth = Math.max(terminalWidth - 4, 20);

	const addMessage = message => {
		setMessages(previous => [...previous.slice(-MAX_MESSAGES + 1), message]);
	};

	const addLog = message => {
		addMessage({role: 'log', content: message});
	};

	const clearInput = () => {
		setInput('');
		setInputKey(k => k + 1);
	};

	const pinToBottom = () => {
		setAutoFollow(true);
	};

	const resetQuitConfirmation = () => {
		setAwaitingQuitConfirmation(false);
	};

	const executeConfirmedQuery = async () => {
		clearInput();
		pinToBottom();
		resetQuitConfirmation();
		setIsProcessing(true);
		const {sql} = pendingQuery;
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
		pinToBottom();
		resetQuitConfirmation();
		addMessage({role: 'system', content: 'Query cancelled'});
		setPendingQuery(null);
	};

	const maxTableRows = Math.max(Math.floor((transcriptHeight - 8) / 2), 3);

	const prepareTableData = data => {
		if (!data || data.length === 0) return null;

		const rows = data.slice(0, maxTableRows);
		const columns = Object.keys(data[0]);

		return rows.map(row => {
			const newRow = {};
			for (const col of columns) {
				const value = row[col];

				if (value === null || value === undefined) {
					newRow[col] = '';
				} else if (typeof value === 'object') {
					newRow[col] = JSON.stringify(value).slice(0, 20);
				} else {
					newRow[col] = String(value).slice(0, 25);
				}
			}

			return newRow;
		});
	};

	const displayMessages = messages.map(message =>
		message.role === 'assistant' && message.data
			? {
					...message,
					data: prepareTableData(message.data),
					resultCount: message.data.length,
					moreRows: Math.max(message.data.length - maxTableRows, 0),
			  }
			: message,
	);

	const transcriptLines = useMemo(
		() => renderTranscriptLines(displayMessages, {width: transcriptWidth}),
		[displayMessages, transcriptWidth],
	);

	const {
		maxScrollTop,
		visibleLines,
		scrollTop: resolvedScrollTop,
	} = useMemo(
		() => getVisibleLineWindow(transcriptLines, scrollTop, transcriptHeight),
		[transcriptHeight, transcriptLines, scrollTop],
	);

	useEffect(() => {
		setScrollTop(current => {
			const previousLineCount = previousMetricsRef.current.lineCount;
			const previousHeight =
				previousMetricsRef.current.transcriptHeight || transcriptHeight;
			const previousMaxScrollTop = Math.max(
				previousLineCount - previousHeight,
				0,
			);
			const wasAtBottom = current >= previousMaxScrollTop;
			const nextScrollTop =
				autoFollow || wasAtBottom
					? maxScrollTop
					: Math.min(current, maxScrollTop);

			previousMetricsRef.current = {
				lineCount: transcriptLines.length,
				transcriptHeight,
			};

			return nextScrollTop;
		});
	}, [autoFollow, maxScrollTop, transcriptHeight, transcriptLines.length]);

	const updateScrollTop = nextScrollTop => {
		const clamped = Math.max(0, Math.min(nextScrollTop, maxScrollTop));
		setScrollTop(clamped);
		setAutoFollow(clamped >= maxScrollTop);
	};

	useInput((character, key) => {
		const isCtrlC = key.ctrl && character === 'c';

		if (isCtrlC) {
			const ctrlCAction = getQueryCtrlCAction({
				inputValue: input,
				isProcessing,
				awaitingQuitConfirmation,
			});

			if (ctrlCAction === 'ignore') {
				return;
			}

			if (ctrlCAction === 'quit') {
				onRequestQuit();
				return;
			}

			if (ctrlCAction === 'clear-input') {
				clearInput();
				resetQuitConfirmation();
				return;
			}

			pinToBottom();
			setAwaitingQuitConfirmation(true);
			return;
		}

		if (awaitingQuitConfirmation) {
			resetQuitConfirmation();
		}

		if (pendingQuery && !isProcessing) {
			if (character.toLowerCase() === 'y') {
				executeConfirmedQuery();
				return;
			}

			if (character.toLowerCase() === 'n' || key.escape) {
				cancelPendingQuery();
				return;
			}
		}

		if (key.upArrow) {
			updateScrollTop(resolvedScrollTop - 1);
			return;
		}

		if (key.downArrow) {
			updateScrollTop(resolvedScrollTop + 1);
			return;
		}

		if (key.pageUp || (key.ctrl && character === 'u')) {
			updateScrollTop(resolvedScrollTop - Math.max(1, transcriptHeight - 2));
			return;
		}

		if (key.pageDown || (key.ctrl && character === 'd')) {
			updateScrollTop(resolvedScrollTop + Math.max(1, transcriptHeight - 2));
			return;
		}

		if (key.home) {
			updateScrollTop(0);
			return;
		}

		if (key.end) {
			updateScrollTop(maxScrollTop);
		}
	});

	const handleSubmit = async query => {
		resetQuitConfirmation();

		if (!query.trim() || isProcessing) return;

		if (pendingQuery) {
			return;
		}

		addMessage({role: 'user', content: query});
		clearInput();
		pinToBottom();

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
		switch (true) {
			case command === '/help': {
				addMessage({
					role: 'system',
					content:
						'Commands:\n/help - Show this help\n/new - Start new thread\n/save <name> - Save last query as preset\n/presets - List saved presets\n/presets <n> - Run preset n\n/delete-preset <n> - Delete preset n\n/add - Add new data source\n/sources - List all sources\n/sources <n> - Switch to source n\n/schema - Show cached schema\n/clear - Clear messages',
				});
				return;
			}

			case command === '/save' || command.startsWith('/save '): {
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
				addMessage(
					result.success
						? {role: 'system', content: `Preset "${name}" saved`}
						: {role: 'error', content: result.error},
				);
				return;
			}

			case command.startsWith('/presets'): {
				const parts = command.split(' ');
				const presets = onLoadPresets();
				if (parts.length === 1) {
					if (presets.length === 0) {
						addMessage({
							role: 'system',
							content:
								'No presets saved. Use /save <name> after running a query.',
						});
						return;
					}

					const list = presets
						.map((preset, index) => `${index + 1}. ${preset.name}`)
						.join('\n');
					addMessage({
						role: 'system',
						content: `Presets:\n${list}\n\nUse /presets <n> to run`,
					});
					return;
				}

				const index = Number.parseInt(parts[1], 10) - 1;
				if (index >= 0 && index < presets.length) {
					const preset = presets[index];
					setPendingQuery({sql: preset.sql, query: preset.name});
					addMessage({role: 'confirm', content: preset.sql});
					return;
				}

				addMessage({
					role: 'error',
					content: `Invalid preset number. Use 1-${presets.length}`,
				});
				return;
			}

			case command === '/delete-preset' ||
				command.startsWith('/delete-preset '): {
				const parts = command.split(' ');
				const presets = onLoadPresets();
				if (parts.length === 1) {
					addMessage({role: 'error', content: 'Usage: /delete-preset <n>'});
					return;
				}

				const index = Number.parseInt(parts[1], 10) - 1;
				if (index >= 0 && index < presets.length) {
					const preset = presets[index];
					const result = onDeletePreset(preset.id);
					addMessage(
						result
							? {role: 'system', content: `Preset "${preset.name}" deleted`}
							: {role: 'error', content: 'Failed to delete preset'},
					);
					return;
				}

				addMessage({
					role: 'error',
					content: `Invalid preset number. Use 1-${presets.length}`,
				});
				return;
			}

			case command.startsWith('/sources'): {
				const parts = command.split(' ');
				if (parts.length === 1) {
					const list = sources
						.map(
							(currentSource, index) =>
								`${index + 1}. ${currentSource.name} (${currentSource.type})${
									currentSource.id === source.id ? ' *' : ''
								}`,
						)
						.join('\n');
					addMessage({role: 'system', content: `Data Sources:\n${list}`});
					return;
				}

				const index = Number.parseInt(parts[1], 10) - 1;
				if (index >= 0 && index < sources.length) {
					onSwitchSource(sources[index]);
					return;
				}

				addMessage({
					role: 'error',
					content: `Invalid source number. Use 1-${sources.length}`,
				});
				return;
			}

			case command === '/source': {
				addMessage({
					role: 'system',
					content: `Connected to: ${source.name} (${source.type})`,
				});
				return;
			}

			case command === '/schema': {
				if (schema) {
					const tables = Object.entries(schema)
						.map(
							([table, cols]) =>
								`${table}: ${cols.map(column => column.column).join(', ')}`,
						)
						.join('\n');
					addMessage({role: 'system', content: `Tables:\n${tables}`});
					return;
				}

				addMessage({role: 'error', content: 'No schema loaded'});
				return;
			}

			case command === '/clear': {
				setMessages([]);
				return;
			}

			case command === '/new': {
				setMessages([{role: 'system', content: 'New thread started'}]);
				return;
			}

			case command === '/add': {
				onManageSources();
				return;
			}

			default: {
				addMessage({role: 'system', content: `Unknown command: ${command}`});
			}
		}
	};

	const hiddenAbove = resolvedScrollTop;
	const hiddenBelow = Math.max(maxScrollTop - resolvedScrollTop, 0);
	const visibleRangeStart =
		transcriptLines.length === 0 ? 0 : resolvedScrollTop + 1;
	const visibleRangeEnd = Math.min(
		resolvedScrollTop + transcriptHeight,
		transcriptLines.length,
	);
	const statusWidth = Math.max(terminalWidth - 4, 20);
	const statusText = awaitingQuitConfirmation
		? truncateStatus(
				'Press Ctrl+C again to quit • Any other key to stay',
				statusWidth,
		  )
		: truncateStatus(
				[
					`Lines ${visibleRangeStart}-${visibleRangeEnd} of ${transcriptLines.length}`,
					hiddenAbove > 0 ? `${hiddenAbove} above` : 'top',
					hiddenBelow > 0 ? `${hiddenBelow} below` : 'following',
					'↑↓ scroll',
					'PgUp/PgDn page',
					'Home/End top/bottom',
				].join(' • '),
				statusWidth,
		  );
	const promptBorderColor = pendingQuery
		? 'yellow'
		: awaitingQuitConfirmation
		? 'red'
		: 'gray';
	const promptColor = pendingQuery
		? 'yellow'
		: awaitingQuitConfirmation
		? 'red'
		: 'cyan';
	const promptPlaceholder = pendingQuery
		? 'Press Y to run, N to cancel'
		: awaitingQuitConfirmation
		? 'Press Ctrl+C again to quit'
		: 'Ask a question about your data...';

	return (
		<Box flexDirection="column" height={terminalHeight}>
			<Box paddingX={2} paddingTop={1} paddingBottom={1} flexShrink={0}>
				<Text bold color="cyan">
					{source.name}
				</Text>
				<Text color="gray"> ({source.type})</Text>
				{!hasApiKey && <Text color="red"> [No API Key]</Text>}
			</Box>

			<Box flexDirection="column" height={transcriptHeight} paddingX={2}>
				{visibleLines.map(line => (
					<Box key={line.key}>
						{line.segments.map(segment => (
							<Text
								key={segment.key}
								color={segment.color}
								bold={segment.bold}
								dimColor={segment.dimColor}
							>
								{segment.text}
							</Text>
						))}
					</Box>
				))}
			</Box>

			<Box paddingX={2} paddingTop={1} flexShrink={0}>
				{isProcessing ? (
					<Text color="cyan">
						<Spinner /> Thinking...
					</Text>
				) : (
					<Text dimColor>{statusText}</Text>
				)}
			</Box>

			<Box
				borderStyle="single"
				borderColor={promptBorderColor}
				paddingX={2}
				marginX={2}
				marginTop={1}
				flexShrink={0}
			>
				<Text color={promptColor}>❯ </Text>
				<TextInput
					key={inputKey}
					placeholder={promptPlaceholder}
					value={input}
					onChange={value => {
						if (pendingQuery) {
							return;
						}

						resetQuitConfirmation();
						setInput(value);
					}}
					onSubmit={handleSubmit}
				/>
			</Box>

			<Box paddingX={2} paddingTop={1} flexShrink={0}>
				<Text dimColor>📁 {process.cwd().split('/').pop()}</Text>
				<Text dimColor> • </Text>
				<Text color="green">● {source.name}</Text>
				<Text dimColor> • </Text>
				<Text dimColor>⚡ {model.split('/').pop()}</Text>
			</Box>
		</Box>
	);
}
