import React, {useEffect, useRef, useState} from 'react';
import {useKeyboard, useRenderer, useSelectionHandler} from '@opentui/react';
import {TextAttributes} from '@opentui/core';
import DataSourceManager from './components/DataSourceManager.js';
import QueryInterface from './components/QueryInterface.js';
import Spinner from './components/Spinner.js';
import {theme} from './theme.js';
import {copySelectionToClipboard} from './utils/clipboard.js';
import {
	loadDataSources,
	addDataSource,
	loadPresets,
	savePreset,
	removePreset,
	removeDataSource,
} from './utils/ConfigManager.js';
import {
	generateQuery,
	executeQuery,
	fetchSchema,
} from './utils/QueryProcessor.js';

const COPY_FEEDBACK_DURATION_MS = 1500;

function ClipboardToast() {
	return (
		<box
			style={{
				position: 'absolute',
				top: 1,
				right: 2,
				zIndex: 100,
				borderStyle: 'rounded',
				borderColor: theme.green,
				backgroundColor: theme.background,
				paddingX: 1,
			}}
		>
			<text
				fg={theme.green}
				attributes={TextAttributes.BOLD}
				selectable={false}
			>
				✓ Copied to clipboard
			</text>
		</box>
	);
}

export default function App({aiConfig, onRequestQuit = () => {}}) {
	const [appState, setAppState] = useState('manage-sources');
	const [dataSources, setDataSources] = useState(loadDataSources);
	const [selectedSource, setSelectedSource] = useState(null);
	const [schema, setSchema] = useState(null);
	const [schemaError, setSchemaError] = useState(null);
	const [showClipboardToast, setShowClipboardToast] = useState(false);
	const clipboardToastTimerRef = useRef(null);
	const renderer = useRenderer();

	useSelectionHandler(selection => {
		if (!copySelectionToClipboard(renderer, selection)) return;

		setShowClipboardToast(true);
		clearTimeout(clipboardToastTimerRef.current);
		clipboardToastTimerRef.current = setTimeout(() => {
			setShowClipboardToast(false);
		}, COPY_FEEDBACK_DURATION_MS);
	});

	useEffect(
		() => () => {
			clearTimeout(clipboardToastTimerRef.current);
		},
		[],
	);

	useKeyboard(key => {
		if (appState === 'query') return;
		const keyName =
			typeof key.name === 'string' ? key.name.toLowerCase() : key.name;
		if (key.ctrl && keyName === 'c') {
			onRequestQuit();
		}
	});

	const handleAddSource = source => {
		const result = addDataSource(source);
		if (result.success) {
			setDataSources([...dataSources, source]);
		}

		return result;
	};

	const handleDeleteSource = sourceId => {
		const removed = removeDataSource(sourceId);
		if (!removed) return false;

		const nextSources = loadDataSources();
		setDataSources(nextSources);

		if (selectedSource?.id === sourceId) {
			setSelectedSource(null);
			setSchema(null);
			setSchemaError(null);
			setAppState('manage-sources');
		}

		return true;
	};

	const handleSelectSource = async source => {
		setSelectedSource(source);
		setSchemaError(null);
		setSchema(null);
		setAppState('loading-schema');

		const result = await fetchSchema(source.connectionString, source.type);

		if (result.error) {
			setSchemaError(result.error);
		} else {
			setSchema(result.schema);
		}

		setAppState('query');
	};

	const handleGenerateQuery = async (query, history, onLog, abortSignal) => {
		if (!aiConfig.available) {
			return {
				error: aiConfig.unavailableMessage,
				sql: null,
			};
		}

		if (!schema) {
			return {error: 'Database schema not loaded', sql: null};
		}

		return generateQuery(query, schema, aiConfig, history, onLog, abortSignal);
	};

	const handleExecuteQuery = async (sql, onLog, abortSignal) => {
		if (!schema) {
			return {error: 'Database schema not loaded', sql, data: null};
		}

		return executeQuery(
			sql,
			selectedSource.connectionString,
			schema,
			aiConfig,
			onLog,
			abortSignal,
		);
	};

	let content = null;

	if (appState === 'manage-sources') {
		content = (
			<DataSourceManager
				sources={dataSources}
				onSelectSource={handleSelectSource}
				onAddSource={handleAddSource}
			/>
		);
	}

	if (appState === 'loading-schema') {
		content = (
			<box style={{paddingX: 2, paddingY: 1, flexDirection: 'column'}}>
				<text fg={theme.cyan} attributes={1}>
					{selectedSource.name}
				</text>
				<box style={{marginTop: 1}}>
					<text>
						<Spinner /> Loading database schema...
					</text>
				</box>
			</box>
		);
	}

	if (appState === 'query') {
		content = (
			<QueryInterface
				aiAvailable={aiConfig.available}
				aiUnavailableMessage={aiConfig.unavailableMessage}
				model={aiConfig.model}
				source={selectedSource}
				sources={dataSources}
				schema={schema}
				schemaError={schemaError}
				onDeletePreset={presetId => removePreset(selectedSource.id, presetId)}
				onDeleteSource={handleDeleteSource}
				onGenerateQuery={handleGenerateQuery}
				onExecuteQuery={handleExecuteQuery}
				onLoadPresets={() => loadPresets(selectedSource.id)}
				onManageSources={() => setAppState('manage-sources')}
				onRequestQuit={onRequestQuit}
				onSavePreset={preset => savePreset(selectedSource.id, preset)}
				onSwitchSource={handleSelectSource}
			/>
		);
	}

	return (
		<box style={{width: '100%', height: '100%'}}>
			{content}
			{showClipboardToast ? <ClipboardToast /> : null}
		</box>
	);
}
