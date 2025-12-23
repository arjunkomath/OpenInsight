import React, {useState, useEffect} from 'react';
import {Box, Text} from 'ink';
import Spinner from 'ink-spinner';
import DataSourceManager from './components/DataSourceManager.js';
import QueryInterface from './components/QueryInterface.js';
import {
	loadDataSources,
	addDataSource,
	loadPresets,
	savePreset,
	removePreset,
} from './utils/ConfigManager.js';
import {
	generateQuery,
	executeQuery,
	fetchSchema,
} from './utils/QueryProcessor.js';

const OPENROUTER_KEY = process.env.OPENROUTER_KEY;
const OPENROUTER_MODEL =
	process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';

export default function App() {
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

	const handleAddSource = source => {
		const result = addDataSource(source);
		if (result.success) {
			setDataSources([...dataSources, source]);
		}
		return result;
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

	const handleGenerateQuery = async (query, history, onLog) => {
		if (!OPENROUTER_KEY) {
			return {
				error: 'OPENROUTER_KEY environment variable is required',
				sql: null,
			};
		}

		if (!schema) {
			return {error: 'Database schema not loaded', sql: null};
		}

		return await generateQuery(
			query,
			schema,
			OPENROUTER_KEY,
			OPENROUTER_MODEL,
			history,
			onLog,
		);
	};

	const handleExecuteQuery = async (sql, onLog) => {
		if (!schema) {
			return {error: 'Database schema not loaded', sql, data: null};
		}

		return await executeQuery(
			sql,
			selectedSource.connectionString,
			schema,
			OPENROUTER_KEY,
			OPENROUTER_MODEL,
			onLog,
		);
	};

	if (loading && dataSources.length === 0) {
		return (
			<Box padding={1}>
				<Text>Loading...</Text>
			</Box>
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
			<Box padding={1} flexDirection="column">
				<Text bold color="cyan">
					{selectedSource.name}
				</Text>
				<Text><Spinner /> Loading database schema...</Text>
			</Box>
		);
	}

	if (appState === 'query') {
		return (
			<QueryInterface
				source={selectedSource}
				sources={dataSources}
				schema={schema}
				schemaError={schemaError}
				onGenerateQuery={handleGenerateQuery}
				onExecuteQuery={handleExecuteQuery}
				onSwitchSource={handleSelectSource}
				onManageSources={() => setAppState('manage-sources')}
				onLoadPresets={() => loadPresets(selectedSource.id)}
				onSavePreset={preset => savePreset(selectedSource.id, preset)}
				onDeletePreset={presetId => removePreset(selectedSource.id, presetId)}
				hasApiKey={Boolean(OPENROUTER_KEY)}
				model={OPENROUTER_MODEL}
			/>
		);
	}

	return null;
}
