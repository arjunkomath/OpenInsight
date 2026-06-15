const state = {
	status: null,
	sources: [],
	selectedSourceId: null,
	schema: null,
	presets: [],
	messages: [],
	pendingSql: '',
	results: null,
	logs: [],
	loading: false,
	error: '',
};

const app = document.querySelector('#app');

const api = async (path, options = {}) => {
	const response = await fetch(path, {
		...options,
		headers: {
			'content-type': 'application/json',
			...(options.headers || {}),
		},
	});
	const data = await response.json();
	if (!response.ok) throw new Error(data.error || 'Request failed');
	return data;
};

const escapeHtml = value =>
	String(value ?? '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#039;');

const setState = patch => {
	Object.assign(state, patch);
	render();
};

const selectedSource = () =>
	state.sources.find(source => source.id === state.selectedSourceId) || null;

const loadSources = async () => {
	const {sources} = await api('/api/sources');
	const selectedSourceId = sources.some(
		source => source.id === state.selectedSourceId,
	)
		? state.selectedSourceId
		: null;

	setState({
		sources,
		selectedSourceId,
	});
	if (selectedSourceId) await selectSource(selectedSourceId);
};

const selectSource = async sourceId => {
	setState({
		selectedSourceId: sourceId,
		schema: null,
		presets: [],
		results: null,
		pendingSql: '',
		error: '',
	});
	try {
		const [{schema}, {presets}] = await Promise.all([
			api(`/api/sources/${sourceId}/schema`),
			api(`/api/sources/${sourceId}/presets`),
		]);
		setState({schema, presets});
	} catch (error) {
		setState({error: error.message});
	}
};

const addSource = async event => {
	event.preventDefault();
	const form = new FormData(event.currentTarget);
	setState({loading: true, error: ''});
	try {
		const {source} = await api('/api/sources', {
			method: 'POST',
			body: JSON.stringify({
				name: form.get('name'),
				connectionString: form.get('connectionString'),
			}),
		});
		event.currentTarget.reset();
		setState({
			sources: [...state.sources, source],
		});
	} catch (error) {
		setState({error: error.message});
	} finally {
		setState({loading: false});
	}
};

const deleteSource = async sourceId => {
	if (!confirm('Delete this data source and its presets?')) return;
	setState({loading: true, error: ''});
	try {
		await api(`/api/sources/${sourceId}`, {method: 'DELETE'});
		const sources = state.sources.filter(source => source.id !== sourceId);
		setState({
			sources,
			selectedSourceId: null,
			schema: null,
			presets: [],
		});
	} catch (error) {
		setState({error: error.message});
	} finally {
		setState({loading: false});
	}
};

const generateSql = async event => {
	event.preventDefault();
	const form = new FormData(event.currentTarget);
	const query = form.get('query')?.trim();
	if (!query || !state.selectedSourceId) return;

	setState({loading: true, error: '', logs: [], pendingSql: '', results: null});
	try {
		const result = await api('/api/query/generate', {
			method: 'POST',
			body: JSON.stringify({
				sourceId: state.selectedSourceId,
				query,
				history: state.messages.slice(-10),
			}),
		});
		if (result.error) throw new Error(result.error);
		setState({
			pendingSql: result.sql,
			logs: result.logs || [],
			messages: [...state.messages, {role: 'user', content: query}],
		});
	} catch (error) {
		setState({error: error.message});
	} finally {
		setState({loading: false});
	}
};

const executeSql = async () => {
	const sql = state.pendingSql?.trim();
	if (!sql || !state.selectedSourceId) return;

	setState({loading: true, error: '', logs: [], results: null});
	try {
		const result = await api('/api/query/execute', {
			method: 'POST',
			body: JSON.stringify({sourceId: state.selectedSourceId, sql}),
		});
		if (result.error) throw new Error(result.error);
		setState({
			pendingSql: result.sql,
			results: result.data || [],
			logs: result.logs || [],
			messages: [...state.messages, {role: 'assistant', content: result.sql}],
		});
	} catch (error) {
		setState({error: error.message});
	} finally {
		setState({loading: false});
	}
};

const saveCurrentPreset = async () => {
	const sql = state.pendingSql?.trim();
	if (!sql || !state.selectedSourceId) return;
	const name = prompt('Preset name');
	if (!name) return;

	try {
		const {presets} = await api(
			`/api/sources/${state.selectedSourceId}/presets`,
			{
				method: 'POST',
				body: JSON.stringify({name, sql}),
			},
		);
		setState({presets});
	} catch (error) {
		setState({error: error.message});
	}
};

const usePreset = preset => {
	setState({pendingSql: preset.sql, results: null, error: ''});
};

const deletePreset = async presetId => {
	try {
		await api(`/api/sources/${state.selectedSourceId}/presets/${presetId}`, {
			method: 'DELETE',
		});
		setState({presets: state.presets.filter(preset => preset.id !== presetId)});
	} catch (error) {
		setState({error: error.message});
	}
};

const renderSources = () => {
	if (state.sources.length === 0) {
		return '<span class="muted">No sources yet</span>';
	}

	return `
		<select id="source-select" ${state.loading ? 'disabled' : ''}>
			<option value="">Choose a source…</option>
			${state.sources
				.map(
					source => `
						<option value="${source.id}" ${source.id === state.selectedSourceId ? 'selected' : ''}>
							${escapeHtml(source.name)} · ${escapeHtml(source.type)}
						</option>
					`,
				)
				.join('')}
		</select>
	`;
};

const renderSchema = () => {
	if (!state.selectedSourceId)
		return '<p class="meta">Select a source to inspect schema.</p>';
	if (!state.schema) return '<p class="meta">Loading schema…</p>';

	return Object.entries(state.schema)
		.map(
			([table, columns]) => `
				<div class="schema-table">
					<strong>${escapeHtml(table)}</strong>
					<div class="schema-columns">
						${columns
							.map(
								column =>
									`<span class="pill">${escapeHtml(column.column)} · ${escapeHtml(column.type)}</span>`,
							)
							.join('')}
					</div>
				</div>
			`,
		)
		.join('');
};

const renderPresets = () => {
	if (state.presets.length === 0)
		return '<p class="muted">No saved presets.</p>';

	return state.presets
		.map(
			preset => `
				<div class="preset-row">
					<strong>${escapeHtml(preset.name)}</strong>
					<div class="actions">
						<button data-use-preset="${preset.id}">Use</button>
						<button class="danger" data-delete-preset="${preset.id}">Delete</button>
					</div>
				</div>
			`,
		)
		.join('');
};

const renderResults = () => {
	if (!state.results) return '';
	if (state.results.length === 0)
		return '<div class="notice">Query returned no rows.</div>';

	const columns = Object.keys(state.results[0]);
	const rowLabel = state.results.length === 1 ? 'row' : 'rows';
	return `
		<section class="panel results-panel">
			<div class="eyebrow">${state.results.length} ${rowLabel}</div>
			<div class="table-wrap">
				<table>
					<thead><tr>${columns.map(column => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead>
					<tbody>
						${state.results
							.map(
								row =>
									`<tr>${columns
										.map(
											column =>
												`<td>${escapeHtml(typeof row[column] === 'object' ? JSON.stringify(row[column], null, 2) : row[column])}</td>`,
										)
										.join('')}</tr>`,
							)
							.join('')}
					</tbody>
				</table>
			</div>
		</section>
	`;
};

const render = () => {
	const source = selectedSource();
	app.innerHTML = `
		<main class="shell">
			<header class="topbar">
				<div>
					<div class="brand">OpenInsight</div>
					<div class="muted">${source ? `${escapeHtml(source.name)} · ${escapeHtml(source.type)}` : 'Project-local database queries'}</div>
				</div>
				<div class="source-control">${renderSources()}</div>
			</header>

			${state.error ? `<div class="error">${escapeHtml(state.error)}</div>` : ''}
			${!state.status?.hasApiKey ? '<div class="notice">OPENROUTER_KEY is not set. Query generation is disabled.</div>' : ''}

			<section class="panel">
				<form class="composer" id="query-form">
					<label for="query-input">Question</label>
					<textarea id="query-input" name="query" placeholder="Ask a question about your data…" ${!state.selectedSourceId || state.loading ? 'disabled' : ''}></textarea>
					<div class="actions">
						<button class="primary" ${!state.selectedSourceId || state.loading ? 'disabled' : ''}>Generate SQL</button>
						${state.loading ? '<span class="muted">Working…</span>' : ''}
					</div>
				</form>
			</section>

						${
							state.pendingSql
								? `
			<section class="panel sql-panel">
								<div class="panel-head">
									<span class="eyebrow">Generated SQL</span>
									<button class="text-button" id="copy-sql">Copy</button>
								</div>
								<pre class="sql"><code>${escapeHtml(state.pendingSql)}</code></pre>
								<div class="actions">
									<button class="primary" id="run-sql" ${state.loading ? 'disabled' : ''}>Run query</button>
									<button id="save-preset" ${state.loading ? 'disabled' : ''}>Save preset</button>
								</div>
			</section>
						`
								: ''
						}

			${renderResults()}

			<section class="secondary">
				<details>
					<summary>Add source</summary>
					<form class="form" id="source-form">
						<label>Name</label>
						<input name="name" placeholder="Local analytics" required />
						<label>Connection string</label>
						<input name="connectionString" placeholder="sqlite://./data.db" required />
						<button ${state.loading ? 'disabled' : ''}>Add and test</button>
					</form>
				</details>

				<details>
					<summary>Presets</summary>
					<div class="preset-list">${renderPresets()}</div>
				</details>

				<details>
					<summary>Schema</summary>
					<div class="schema-list">${renderSchema()}</div>
				</details>

				${state.logs.length > 0 ? `<details><summary>Logs</summary><div class="timeline">${state.logs.map(log => `<div>${escapeHtml(log)}</div>`).join('')}</div></details>` : ''}

				${source ? `<button class="danger text-button" data-delete-source="${source.id}">Delete source</button>` : ''}
			</section>
		</main>
	`;

	document.querySelector('#source-form')?.addEventListener('submit', addSource);
	document
		.querySelector('#source-select')
		?.addEventListener('change', event => {
			const sourceId = event.target.value;
			if (sourceId) {
				selectSource(sourceId);
				return;
			}

			setState({
				selectedSourceId: null,
				schema: null,
				presets: [],
				results: null,
				pendingSql: '',
				error: '',
			});
		});
	document
		.querySelector('#query-form')
		?.addEventListener('submit', generateSql);
	document.querySelector('#run-sql')?.addEventListener('click', executeSql);
	document
		.querySelector('#copy-sql')
		?.addEventListener('click', async event => {
			try {
				await navigator.clipboard.writeText(state.pendingSql);
				const button = event.currentTarget;
				button.textContent = 'Copied';
				setTimeout(() => {
					button.textContent = 'Copy';
				}, 1200);
			} catch {
				/* clipboard unavailable */
			}
		});
	document
		.querySelector('#save-preset')
		?.addEventListener('click', saveCurrentPreset);
	document.querySelectorAll('[data-delete-source]').forEach(button => {
		button.addEventListener('click', () =>
			deleteSource(button.dataset.deleteSource),
		);
	});
	document.querySelectorAll('[data-use-preset]').forEach(button => {
		button.addEventListener('click', () => {
			const preset = state.presets.find(
				preset => preset.id === button.dataset.usePreset,
			);
			if (preset) usePreset(preset);
		});
	});
	document.querySelectorAll('[data-delete-preset]').forEach(button => {
		button.addEventListener('click', () =>
			deletePreset(button.dataset.deletePreset),
		);
	});
};

const init = async () => {
	try {
		const status = await api('/api/status');
		setState({status});
		await loadSources();
	} catch (error) {
		setState({error: error.message});
	}
};

render();
init();
