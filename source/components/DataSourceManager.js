import React, {useState} from 'react';
import {useTerminalDimensions} from '@opentui/react';
import {TextAttributes} from '@opentui/core';
import Spinner from './Spinner.js';
import {theme} from '../theme.js';
import {
	testConnection,
	validateConnectionString,
} from '../utils/DbConnector.js';

const BOLD = TextAttributes.BOLD;
const DIM = TextAttributes.DIM;

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
	const {height: terminalHeight} = useTerminalDimensions();
	const selectColors = {
		backgroundColor: theme.transparent,
		focusedBackgroundColor: theme.transparent,
		textColor: theme.default,
		focusedTextColor: theme.default,
		selectedBackgroundColor: theme.transparent,
		selectedTextColor: theme.cyan,
	};
	const inputColors = {
		backgroundColor: theme.transparent,
		focusedBackgroundColor: theme.transparent,
		textColor: theme.default,
		focusedTextColor: theme.default,
		placeholderColor: theme.gray,
		cursorColor: theme.cyan,
	};

	const handleAddSource = async value => {
		const connection = value ?? connectionString;
		if (!connection.trim() || isValidating) return;

		setError(null);

		const validation = validateConnectionString(connection);
		if (!validation.isValid) {
			setError(validation.error);
			return;
		}

		setIsValidating(true);

		const result = await testConnection(connection);

		setIsValidating(false);

		if (!result.success) {
			setError(result.error);
			return;
		}

		const newSource = {
			id: crypto.randomUUID(),
			name: sourceName,
			connectionString: connection,
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
				<box style={{flexDirection: 'column', height: terminalHeight}}>
					<box style={{paddingX: 2, paddingY: 1, flexDirection: 'row'}}>
						<text fg={theme.cyan} attributes={BOLD}>
							OPEN
						</text>
						<text fg={theme.magenta} attributes={BOLD}>
							INSIGHT
						</text>
					</box>

					<box
						style={{
							flexDirection: 'column',
							flexGrow: 1,
							paddingX: 2,
							gap: 1,
						}}
					>
						<box style={{flexDirection: 'column'}}>
							<text fg={theme.yellow}>No data sources configured.</text>
							<text fg={theme.default}>
								Add a database connection to get started.
							</text>
						</box>
						<box>
							<select
								focused
								height={3}
								width={32}
								{...selectColors}
								options={[
									{
										name: '→ Add a data source',
										description: '',
										value: 'add',
									},
								]}
								showDescription={false}
								onSelect={() => {
									setMode('add-name');
									setSourceName('');
									setConnectionString('');
									setError(null);
								}}
							/>
						</box>
					</box>

					<box
						style={{
							paddingX: 2,
							paddingBottom: 1,
							flexDirection: 'column',
							gap: 1,
						}}
					>
						<box
							style={{
								borderStyle: 'rounded',
								borderColor: theme.yellow,
								paddingX: 1,
							}}
						>
							<text fg={theme.yellow}>
								⚠ AI can make mistakes. Verify queries before running.
							</text>
						</box>
						<text fg={theme.default} attributes={DIM}>
							Press Ctrl+C to exit
						</text>
					</box>
				</box>
			);
		}

		const items = sources.map(source => ({
			name: `  ${source.name} (${source.type})`,
			description: '',
			value: source,
		}));

		items.push({
			name: '+ Add new data source',
			description: '',
			value: 'add',
		});

		const listHeight = Math.max(Math.min(items.length + 1, 12), 4);

		return (
			<box style={{flexDirection: 'column', height: terminalHeight}}>
				<box style={{paddingX: 2, paddingY: 1, flexDirection: 'row'}}>
					<text fg={theme.cyan} attributes={BOLD}>
						OPEN
					</text>
					<text fg={theme.magenta} attributes={BOLD}>
						INSIGHT
					</text>
				</box>

				<box style={{flexDirection: 'column', flexGrow: 1, paddingX: 2}}>
					<text fg={theme.yellow} attributes={BOLD}>
						Select a data source:
					</text>
					<box style={{marginTop: 1, flexDirection: 'column'}}>
						<select
							focused
							height={listHeight}
							width={48}
							{...selectColors}
							options={items}
							showDescription={false}
							onSelect={(_index, option) => {
								if (!option) return;
								if (option.value === 'add') {
									setMode('add-name');
									setSourceName('');
									setConnectionString('');
									setError(null);
								} else {
									onSelectSource(option.value);
								}
							}}
						/>
					</box>
				</box>

				<box
					style={{
						paddingX: 2,
						paddingBottom: 1,
						flexDirection: 'column',
						gap: 1,
					}}
				>
					<box
						style={{
							borderStyle: 'rounded',
							borderColor: theme.yellow,
							paddingX: 1,
						}}
					>
						<text fg={theme.yellow}>
							⚠ AI can make mistakes. Verify queries before running.
						</text>
					</box>
					<text fg={theme.default} attributes={DIM}>
						Press Ctrl+C to exit
					</text>
				</box>
			</box>
		);
	}

	if (mode === 'add-name') {
		return (
			<box style={{flexDirection: 'column', height: terminalHeight}}>
				<box style={{paddingX: 2, paddingY: 1}}>
					<text fg={theme.cyan} attributes={BOLD}>
						Add Data Source
					</text>
				</box>

				<box style={{flexDirection: 'column', flexGrow: 1, paddingX: 2}}>
					<text fg={theme.yellow}>Enter a name for this data source:</text>
					<box style={{marginTop: 1, flexDirection: 'row', height: 1}}>
						<text fg={theme.cyan}>❯ </text>
						<input
							focused
							style={{width: 40}}
							{...inputColors}
							placeholder="e.g., Production DB"
							value={sourceName}
							onInput={setSourceName}
							onSubmit={value => {
								if (value.trim()) {
									setSourceName(value);
									setMode('add-connection');
								}
							}}
						/>
					</box>
				</box>

				<box style={{paddingX: 2, paddingBottom: 1}}>
					<text fg={theme.default} attributes={DIM}>
						Press Enter to continue • Ctrl+C to cancel
					</text>
				</box>
			</box>
		);
	}

	if (mode === 'add-connection') {
		return (
			<box style={{flexDirection: 'column', height: terminalHeight}}>
				<box style={{paddingX: 2, paddingY: 1, flexDirection: 'row'}}>
					<text fg={theme.cyan} attributes={BOLD}>
						Add Data Source
					</text>
					<text fg={theme.gray}> - {sourceName}</text>
				</box>

				<box style={{flexDirection: 'column', flexGrow: 1, paddingX: 2}}>
					<text fg={theme.yellow}>Enter the connection string:</text>
					<box style={{marginTop: 1, flexDirection: 'row', height: 1}}>
						<text fg={theme.cyan}>❯ </text>
						<input
							focused
							style={{width: 60}}
							{...inputColors}
							placeholder="postgres://user:pass@host:5432/database"
							value={connectionString}
							onInput={value => {
								setConnectionString(value);
								setError(null);
							}}
							onSubmit={handleAddSource}
						/>
					</box>

					{isValidating && (
						<box style={{marginTop: 1}}>
							<text>
								<Spinner /> Testing connection...
							</text>
						</box>
					)}

					{error && (
						<box style={{marginTop: 1}}>
							<text fg={theme.red}>Error: {error}</text>
						</box>
					)}

					<box style={{marginTop: 2}}>
						<text fg={theme.default} attributes={DIM}>
							Supported: postgres://, mysql://, sqlite://, mariadb://
						</text>
					</box>
				</box>

				<box style={{paddingX: 2, paddingBottom: 1}}>
					<text fg={theme.default} attributes={DIM}>
						Press Enter to validate and add • Ctrl+C to cancel
					</text>
				</box>
			</box>
		);
	}

	return null;
}
