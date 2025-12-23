import React, {useState} from 'react';
import {Box, Text, useStdout} from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import {Alert, Spinner} from '@inkjs/ui';
import {
	testConnection,
	validateConnectionString,
} from '../utils/DbConnector.js';

export default function DataSourceManager({
	sources,
	onSelectSource,
	onAddSource,
}) {
	const [mode, setMode] = useState('menu');
	const [sourceName, setSourceName] = useState('');
	const [connectionString, setConnectionString] = useState('');
	const [isValidating, setIsValidating] = useState(false);
	const [error, setError] = useState(null);
	const {stdout} = useStdout();
	const terminalHeight = stdout?.rows || 24;

	const handleAddSource = async () => {
		if (!connectionString.trim() || isValidating) return;

		setError(null);

		const validation = validateConnectionString(connectionString);
		if (!validation.isValid) {
			setError(validation.error);
			return;
		}

		setIsValidating(true);

		const result = await testConnection(connectionString);

		setIsValidating(false);

		if (!result.success) {
			setError(result.error);
			return;
		}

		const newSource = {
			id: crypto.randomUUID(),
			name: sourceName,
			connectionString,
			type: validation.protocol,
		};

		const addResult = onAddSource(newSource);
		if (addResult?.error) {
			setError(addResult.error);
			return;
		}

		setSourceName('');
		setConnectionString('');
		setMode('menu');
	};

	if (mode === 'menu') {
		const hasSources = sources.length > 0;

		if (!hasSources) {
			return (
				<Box flexDirection="column" height={terminalHeight}>
					<Box paddingX={1} paddingY={1}>
						<Text bold color="cyan">
							OPEN
						</Text>
						<Text bold color="magenta">
							INSIGHT
						</Text>
					</Box>

					<Box flexDirection="column" flexGrow={1} paddingX={1}>
						<Box flexDirection="column">
							<Text color="yellow">No data sources configured.</Text>
							<Text>Add a database connection to get started.</Text>
						</Box>
						<Box marginTop={2}>
							<SelectInput
								items={[{label: '→ Add a data source', value: 'add'}]}
								onSelect={() => {
									setMode('add-name');
									setSourceName('');
									setConnectionString('');
									setError(null);
								}}
							/>
						</Box>
					</Box>

					<Box paddingX={1} paddingBottom={1} flexDirection="column" gap={1}>
						<Alert variant="warning">
							AI can make mistakes. Verify queries before running.
						</Alert>
						<Text dimColor>Press Ctrl+C to exit</Text>
					</Box>
				</Box>
			);
		}

		const items = sources.map(source => ({
			label: `  ${source.name} (${source.type})`,
			value: source,
		}));

		items.push({
			label: '+ Add new data source',
			value: 'add',
		});

		return (
			<Box flexDirection="column" height={terminalHeight}>
				<Box paddingX={1} paddingY={1}>
					<Text bold color="cyan">
						OPEN
					</Text>
					<Text bold color="magenta">
						INSIGHT
					</Text>
				</Box>

				<Box flexDirection="column" flexGrow={1} paddingX={1}>
					<Text color="yellow" bold>
						Select a data source:
					</Text>
					<Box marginTop={1} flexDirection="column">
						<SelectInput
							items={items}
							onSelect={item => {
								if (item.value === 'add') {
									setMode('add-name');
									setSourceName('');
									setConnectionString('');
									setError(null);
								} else {
									onSelectSource(item.value);
								}
							}}
						/>
					</Box>
				</Box>

				<Box paddingX={1} paddingBottom={1} flexDirection="column" gap={1}>
					<Alert variant="warning">
						AI can make mistakes. Verify queries before running.
					</Alert>
					<Text dimColor>Press Ctrl+C to exit</Text>
				</Box>
			</Box>
		);
	}

	if (mode === 'add-name') {
		return (
			<Box flexDirection="column" height={terminalHeight}>
				<Box paddingX={1} paddingY={1}>
					<Text bold color="cyan">
						Add Data Source
					</Text>
				</Box>

				<Box flexDirection="column" flexGrow={1} paddingX={1}>
					<Text color="yellow">Enter a name for this data source:</Text>
					<Box marginTop={1}>
						<Text color="cyan">❯ </Text>
						<TextInput
							value={sourceName}
							onChange={setSourceName}
							placeholder="e.g., Production DB"
							onSubmit={() => {
								if (sourceName.trim()) {
									setMode('add-connection');
								}
							}}
						/>
					</Box>
				</Box>

				<Box paddingX={1} paddingBottom={1}>
					<Text dimColor>Press Enter to continue • Ctrl+C to cancel</Text>
				</Box>
			</Box>
		);
	}

	if (mode === 'add-connection') {
		return (
			<Box flexDirection="column" height={terminalHeight}>
				<Box paddingX={1} paddingY={1}>
					<Text bold color="cyan">
						Add Data Source
					</Text>
					<Text color="gray"> - {sourceName}</Text>
				</Box>

				<Box flexDirection="column" flexGrow={1} paddingX={1}>
					<Text color="yellow">Enter the connection string:</Text>
					<Box marginTop={1}>
						<Text color="cyan">❯ </Text>
						<TextInput
							value={connectionString}
							onChange={value => {
								setConnectionString(value);
								setError(null);
							}}
							placeholder="postgres://user:pass@host:5432/database"
							onSubmit={handleAddSource}
						/>
					</Box>

					{isValidating && (
						<Box marginTop={1}>
							<Spinner label="Testing connection..." />
						</Box>
					)}

					{error && (
						<Box marginTop={1}>
							<Text color="red">Error: {error}</Text>
						</Box>
					)}

					<Box marginTop={2}>
						<Text dimColor>
							Supported: postgres://, mysql://, sqlite://, mariadb://
						</Text>
					</Box>
				</Box>

				<Box paddingX={1} paddingBottom={1}>
					<Text dimColor>
						Press Enter to validate and add • Ctrl+C to cancel
					</Text>
				</Box>
			</Box>
		);
	}
}
