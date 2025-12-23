import {readFileSync, writeFileSync, existsSync, mkdirSync} from 'fs';
import {join} from 'path';

const CONFIG_DIR = join(process.cwd(), '.openinsight');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

function ensureConfigDir() {
	if (!existsSync(CONFIG_DIR)) {
		mkdirSync(CONFIG_DIR, {recursive: true});
	}
}

export function loadDataSources() {
	try {
		if (existsSync(CONFIG_FILE)) {
			const content = readFileSync(CONFIG_FILE, 'utf-8');
			const config = JSON.parse(content);
			return config.dataSources || [];
		}
	} catch {
		return [];
	}

	return [];
}

export function saveDataSources(dataSources) {
	try {
		ensureConfigDir();
		const config = {
			version: '1.0.0',
			lastModified: new Date().toISOString(),
			dataSources,
		};

		writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
		return true;
	} catch {
		return false;
	}
}

export function addDataSource(source) {
	const sources = loadDataSources();

	if (sources.some(s => s.id === source.id || s.name === source.name)) {
		return {
			success: false,
			error: 'A data source with this name already exists',
		};
	}

	sources.push(source);
	const saved = saveDataSources(sources);
	return {success: saved, error: saved ? null : 'Failed to save configuration'};
}

export function removeDataSource(id) {
	const sources = loadDataSources();
	const filtered = sources.filter(s => s.id !== id);

	if (filtered.length === sources.length) {
		return false;
	}

	return saveDataSources(filtered);
}

export function getDataSource(id) {
	const sources = loadDataSources();
	return sources.find(s => s.id === id) || null;
}

export function loadPresets(sourceId) {
	try {
		if (existsSync(CONFIG_FILE)) {
			const content = readFileSync(CONFIG_FILE, 'utf-8');
			const config = JSON.parse(content);
			const presets = config.presets || {};
			return presets[sourceId] || [];
		}
	} catch {
		return [];
	}
	return [];
}

export function savePreset(sourceId, preset) {
	try {
		ensureConfigDir();
		let config = {version: '1.0.0', dataSources: [], presets: {}};

		if (existsSync(CONFIG_FILE)) {
			const content = readFileSync(CONFIG_FILE, 'utf-8');
			config = JSON.parse(content);
			config.presets = config.presets || {};
		}

		const sourcePresets = config.presets[sourceId] || [];

		if (sourcePresets.some(p => p.name === preset.name)) {
			return {success: false, error: 'A preset with this name already exists'};
		}

		sourcePresets.push({
			id: crypto.randomUUID(),
			name: preset.name,
			sql: preset.sql,
			createdAt: new Date().toISOString(),
		});

		config.presets[sourceId] = sourcePresets;
		config.lastModified = new Date().toISOString();

		writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
		return {success: true};
	} catch (error) {
		return {success: false, error: error.message};
	}
}

export function removePreset(sourceId, presetId) {
	try {
		if (!existsSync(CONFIG_FILE)) return false;

		const content = readFileSync(CONFIG_FILE, 'utf-8');
		const config = JSON.parse(content);

		if (!config.presets || !config.presets[sourceId]) return false;

		config.presets[sourceId] = config.presets[sourceId].filter(
			p => p.id !== presetId,
		);
		config.lastModified = new Date().toISOString();

		writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
		return true;
	} catch {
		return false;
	}
}
