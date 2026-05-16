import React, {useState} from 'react';
import {useKeyboard, useTerminalDimensions} from '@opentui/react';
import {TextAttributes} from '@opentui/core';
import Spinner from './Spinner.js';
import {theme} from '../theme.js';
import {
	testConnection,
	validateConnectionString,
} from '../utils/DbConnector.js';
import {APP_VERSION} from '../utils/version.js';

const BOLD = TextAttributes.BOLD;
const DIM = TextAttributes.DIM;

export default function DataSourceManager({
	sources,
	onSelectSource,
	onAddSource,
}) {
	const [mode, setMode] = useState('menu');
	const [activeAddField, setActiveAddField] = useState('name');
	const [sourceName, setSourceName] = useState('');
	const [connectionString, setConnectionString] = useState('');
	const [isValidating, setIsValidating] = useState(false);
	const [error, setError] = useState(null);
	const {width: terminalWidth, height: terminalHeight} =
		useTerminalDimensions();
	const addInputWidth = Math.max(terminalWidth - 8, 40);
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

	const startAddingSource = () => {
		setMode('add');
		setActiveAddField('name');
		setSourceName('');
		setConnectionString('');
		setError(null);
	};

	const handleAddSource = async value => {
		const connection = value ?? connectionString;
		const trimmedConnection = connection.trim();
		if (!trimmedConnection || isValidating) return;
		if (!sourceName.trim()) {
			setError('Data source name is required');
			setActiveAddField('name');
			return;
		}

		setError(null);

		const validation = validateConnectionString(trimmedConnection);
		if (!validation.isValid) {
			setError(validation.error);
			return;
		}

		setIsValidating(true);

		const result = await testConnection(trimmedConnection);

		setIsValidating(false);

		if (!result.success) {
			setError(result.error);
			return;
		}

		const newSource = {
			id: crypto.randomUUID(),
			name: sourceName.trim(),
			connectionString: trimmedConnection,
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
		setActiveAddField('name');
	};

	useKeyboard(key => {
		if (mode !== 'add' || isValidating) return;

		const keyName =
			typeof key.name === 'string' ? key.name.toLowerCase() : key.name;

		if (keyName === 'tab') {
			setActiveAddField(current =>
				key.shift
					? current === 'connection'
						? 'name'
						: 'connection'
					: current === 'name'
						? 'connection'
						: 'name',
			);
		}
	});

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
						<text fg={theme.gray}> v{APP_VERSION}</text>
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
								onSelect={startAddingSource}
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
					<text fg={theme.gray}> v{APP_VERSION}</text>
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
									startAddingSource();
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

	if (mode === 'add') {
		return (
			<box style={{flexDirection: 'column', height: terminalHeight}}>
				<box style={{paddingX: 2, paddingY: 1}}>
					<text fg={theme.cyan} attributes={BOLD}>
						Add Data Source
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
					<text fg={theme.yellow}>Name</text>
					<box style={{flexDirection: 'row', height: 1}}>
						<text fg={theme.cyan}>❯ </text>
						<input
							key="data-source-name"
							focused={activeAddField === 'name'}
							style={{width: Math.min(addInputWidth, 64)}}
							{...inputColors}
							placeholder="e.g., Production DB"
							value={sourceName}
							onInput={value => {
								setSourceName(value);
								setError(null);
							}}
							onSubmit={value => {
								const name = value.trim();
								if (name) {
									setSourceName(name);
									setError(null);
									setActiveAddField('connection');
								} else {
									setError('Data source name is required');
								}
							}}
						/>
					</box>

					<text fg={theme.yellow}>Connection string</text>
					<box style={{flexDirection: 'row', height: 1}}>
						<text fg={theme.cyan}>❯ </text>
						<input
							key="data-source-connection"
							focused={activeAddField === 'connection'}
							style={{width: addInputWidth}}
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
						Tab to switch fields • Enter to continue/add • Ctrl+C to cancel
					</text>
				</box>
			</box>
		);
	}

	return null;
}
