import process from 'node:process';
import React, {useState, useEffect} from 'react';
import {useKeyboard} from '@opentui/react';
import DataSourceManager from './components/DataSourceManager.js';
import QueryInterface from './components/QueryInterface.js';
import Spinner from './components/Spinner.js';
import {theme} from './theme.js';
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

const {OPENROUTER_KEY, OPENROUTER_MODEL = 'google/gemini-2.5-flash'} =
	process.env;

export default function App({onRequestQuit = () => {}}) {
	const [appState, setAppState] = useState('manage-sources');
	const [dataSources, setDataSources] = useState([]);
	const [selectedSource, setSelectedSource] = useState(null);
	const [schema, setSchema] = useState(null);
	const [loading, setLoading] = useState(true);
	const [schemaError, setSchemaError] = useState(null);

	useEffect(() => {
		const sources = loadDataSources();
		setDataSources(sources);
		setLoading(false);
	}, []);

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
		if (!OPENROUTER_KEY) {
			return {
				error: 'OPENROUTER_KEY environment variable is required',
				sql: null,
			};
		}

		if (!schema) {
			return {error: 'Database schema not loaded', sql: null};
		}

		return generateQuery(
			query,
			schema,
			OPENROUTER_KEY,
			OPENROUTER_MODEL,
			history,
			onLog,
			abortSignal,
		);
	};

	const handleExecuteQuery = async (sql, onLog, abortSignal) => {
		if (!schema) {
			return {error: 'Database schema not loaded', sql, data: null};
		}

		return executeQuery(
			sql,
			selectedSource.connectionString,
			schema,
			OPENROUTER_KEY,
			OPENROUTER_MODEL,
			onLog,
			abortSignal,
		);
	};

	if (loading && dataSources.length === 0) {
		return (
			<box style={{paddingX: 2, paddingY: 1}}>
				<text>Loading...</text>
			</box>
		);
	}

	if (appState === 'manage-sources') {
		return (
			<DataSourceManager
				sources={dataSources}
				onSelectSource={handleSelectSource}
				onAddSource={handleAddSource}
			/>
		);
	}

	if (appState === 'loading-schema') {
		return (
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
		return (
			<QueryInterface
				hasApiKey={Boolean(OPENROUTER_KEY)}
				model={OPENROUTER_MODEL}
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

	return null;
}
