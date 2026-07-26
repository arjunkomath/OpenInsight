const MAX_RENDERED_ROWS = 500;

const state = {
	status: null,
	sources: [],
	selectedSourceId: null,
	schema: null,
	schemaError: '',
	schemaLoading: false,
	schemaFilter: '',
	expandedTables: new Set(),
	presets: [],
	turns: [],
	messages: [],
	pendingSql: '',
	results: null,
	resultsSql: '',
	logs: [],
	busy: null,
	error: '',
	openSections: {sources: true, presets: true, history: true, schema: true},
	confirming: null,
};

let confirmTimer = null;
let elapsedTimer = null;
let busyStartedAt = 0;

const updateElapsed = () => {
	const seconds = Math.round((Date.now() - busyStartedAt) / 1000);
	for (const node of document.querySelectorAll('.elapsed')) {
		node.textContent = `${seconds}s`;
	}
};

const startElapsed = () => {
	busyStartedAt = Date.now();
	clearInterval(elapsedTimer);
	elapsedTimer = setInterval(updateElapsed, 1000);
};

const stopElapsed = () => {
	clearInterval(elapsedTimer);
	elapsedTimer = null;
};

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

const selectedSource = () =>
	state.sources.find(source => source.id === state.selectedSourceId) || null;

const isBusy = () => state.busy !== null;

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

document.querySelector('#app').innerHTML = `
	<div class="app">
		<header class="topbar">
			<div class="identity">
				<span class="brand">OpenInsight</span>
				<span class="crumb" id="crumb"></span>
			</div>
			<div class="topbar-meta" id="topbar-meta"></div>
		</header>

		<div class="body">
			<aside class="sidebar">
				<section class="rail" data-section="sources">
					<div class="rail-head">
						<button class="rail-toggle" data-action="toggle-section" data-section="sources">
							<span class="chevron"></span>Sources
						</button>
						<button class="icon-button" data-action="open-source-dialog" title="Add data source">+</button>
					</div>
					<div class="rail-body" id="source-list"></div>
				</section>

				<section class="rail" data-section="presets">
					<div class="rail-head">
						<button class="rail-toggle" data-action="toggle-section" data-section="presets">
							<span class="chevron"></span>Presets
						</button>
						<span class="rail-count" id="preset-count"></span>
					</div>
					<div class="rail-body" id="preset-list"></div>
				</section>

				<section class="rail" data-section="history">
					<div class="rail-head">
						<button class="rail-toggle" data-action="toggle-section" data-section="history">
							<span class="chevron"></span>Session
						</button>
						<button class="text-button" data-action="clear-context" id="clear-context">Clear</button>
					</div>
					<div class="rail-body" id="history-list"></div>
				</section>

				<section class="rail rail-grow" data-section="schema">
					<div class="rail-head">
						<button class="rail-toggle" data-action="toggle-section" data-section="schema">
							<span class="chevron"></span>Schema
						</button>
						<span class="rail-count" id="schema-count"></span>
					</div>
					<div class="rail-body rail-body-scroll">
						<input id="schema-filter" type="search" placeholder="Filter tables and columns" />
						<div id="schema-list"></div>
					</div>
				</section>
			</aside>

			<main class="workspace" id="workspace">
				<div id="banner"></div>

				<section class="panel onboarding" id="onboarding" hidden>
					<h1>Connect a database to get started</h1>
					<p>Ask questions in plain English, review the SQL before it runs, and keep the queries you want to reuse. Everything stays in this project's <code>.openinsight</code> folder.</p>
					<div class="actions">
						<button class="primary" data-action="open-source-dialog" type="button">Add data source</button>
					</div>
					<div class="examples">
						<span class="pill"><span class="pill-name">sqlite://./data.db</span></span>
						<span class="pill"><span class="pill-name">postgres://user:pass@localhost:5432/db</span></span>
						<span class="pill"><span class="pill-name">mysql://user:pass@localhost:3306/db</span></span>
					</div>
				</section>

				<form class="panel composer" id="query-form">
					<div class="panel-head">
						<span class="eyebrow">Ask</span>
						<span class="hint">⌘⏎ to generate</span>
					</div>
					<textarea id="query-input" name="query" rows="3" placeholder="Ask a question about your data…"></textarea>
					<div class="actions">
						<button class="primary" id="generate-button" type="submit">Generate SQL</button>
						<span class="muted" id="composer-status"></span>
					</div>
				</form>

				<section class="panel sql-panel" id="sql-panel" hidden>
					<div class="panel-head">
						<span class="eyebrow">SQL</span>
						<div class="head-actions">
							<button class="text-button" data-action="copy-sql" type="button">Copy</button>
							<button class="text-button" data-action="open-preset-dialog" type="button">Save preset</button>
						</div>
					</div>
					<textarea id="sql-editor" class="sql" spellcheck="false" rows="6"></textarea>
					<div class="actions">
						<button class="primary" data-action="run-sql" type="button" id="run-button">Run query</button>
						<span class="hint">⌘⏎ to run</span>
					</div>
				</section>

				<section class="results" id="results"></section>

				<div id="activity"></div>
			</main>
		</div>
	</div>

	<dialog id="source-dialog">
		<form method="dialog" class="dialog-body" id="source-form">
			<h2>Add data source</h2>
			<label for="source-name">Name</label>
			<input id="source-name" name="name" placeholder="Local analytics" required />
			<label for="source-connection">Connection string</label>
			<input id="source-connection" name="connectionString" placeholder="sqlite://./data.db" required />
			<p class="hint">Supports postgres://, mysql:// and sqlite:// — the connection is tested before it is saved.</p>
			<div class="dialog-error" id="source-dialog-error" hidden></div>
			<div class="dialog-actions">
				<button type="button" data-action="close-dialog" data-dialog="source-dialog">Cancel</button>
				<button class="primary" type="submit" id="source-submit">Add and test</button>
			</div>
		</form>
	</dialog>

	<dialog id="preset-dialog">
		<form method="dialog" class="dialog-body" id="preset-form">
			<h2>Save preset</h2>
			<label for="preset-name">Name</label>
			<input id="preset-name" name="name" placeholder="Weekly signups" required />
			<p class="hint">Saves the SQL currently in the editor for this source.</p>
			<div class="dialog-error" id="preset-dialog-error" hidden></div>
			<div class="dialog-actions">
				<button type="button" data-action="close-dialog" data-dialog="preset-dialog">Cancel</button>
				<button class="primary" type="submit">Save</button>
			</div>
		</form>
	</dialog>
`;

const el = {
	crumb: document.querySelector('#crumb'),
	topbarMeta: document.querySelector('#topbar-meta'),
	sourceList: document.querySelector('#source-list'),
	presetList: document.querySelector('#preset-list'),
	presetCount: document.querySelector('#preset-count'),
	historyList: document.querySelector('#history-list'),
	clearContext: document.querySelector('#clear-context'),
	schemaCount: document.querySelector('#schema-count'),
	schemaFilter: document.querySelector('#schema-filter'),
	schemaList: document.querySelector('#schema-list'),
	banner: document.querySelector('#banner'),
	onboarding: document.querySelector('#onboarding'),
	queryForm: document.querySelector('#query-form'),
	queryInput: document.querySelector('#query-input'),
	generateButton: document.querySelector('#generate-button'),
	composerStatus: document.querySelector('#composer-status'),
	sqlPanel: document.querySelector('#sql-panel'),
	sqlEditor: document.querySelector('#sql-editor'),
	runButton: document.querySelector('#run-button'),
	results: document.querySelector('#results'),
	activity: document.querySelector('#activity'),
	sourceDialog: document.querySelector('#source-dialog'),
	sourceForm: document.querySelector('#source-form'),
	sourceDialogError: document.querySelector('#source-dialog-error'),
	presetDialog: document.querySelector('#preset-dialog'),
	presetForm: document.querySelector('#preset-form'),
	presetDialogError: document.querySelector('#preset-dialog-error'),
};

const setState = patch => {
	Object.assign(state, patch);
	render();
};

const confirmLabel = (id, label) =>
	state.confirming === id ? 'Confirm?' : label;

const armConfirm = id => {
	clearTimeout(confirmTimer);
	setState({confirming: id});
	confirmTimer = setTimeout(() => {
		if (state.confirming === id) setState({confirming: null});
	}, 4000);
};

const renderTopbar = () => {
	const source = selectedSource();
	const tableCount = state.schema ? Object.keys(state.schema).length : null;

	el.crumb.innerHTML = source
		? `${escapeHtml(source.name)}<span class="sep">/</span>${escapeHtml(source.type)}${
				tableCount === null
					? ''
					: `<span class="sep">/</span>${plural(tableCount, 'table')}`
			}`
		: '<span class="muted">No source selected</span>';

	const model = state.status?.model;
	el.topbarMeta.innerHTML = [
		model
			? `<span class="tag" title="Model used for SQL generation">${escapeHtml(model)}</span>`
			: '',
		state.status && !state.status.hasApiKey
			? '<span class="tag tag-warn">No API key</span>'
			: '',
		state.status?.configDir
			? `<span class="tag tag-quiet" title="${escapeHtml(state.status.configDir)}">Local config</span>`
			: '',
	].join('');
};

const renderSources = () => {
	if (state.sources.length === 0) {
		el.sourceList.innerHTML = `
			<p class="empty-line">No sources yet.</p>
			<button class="text-button" data-action="open-source-dialog">Add a data source</button>
		`;
		return;
	}

	el.sourceList.innerHTML = state.sources
		.map(source => {
			const active = source.id === state.selectedSourceId;
			return `
				<div class="row ${active ? 'row-active' : ''}">
					<button class="row-main" data-action="select-source" data-id="${source.id}" ${isBusy() ? 'disabled' : ''}>
						<span class="row-title">${escapeHtml(source.name)}</span>
						<span class="row-sub">${escapeHtml(source.type)}</span>
					</button>
					${
						active
							? `<button class="danger text-button" data-action="delete-source" data-id="${source.id}">${confirmLabel(
									`source:${source.id}`,
									'Delete',
								)}</button>`
							: ''
					}
				</div>
			`;
		})
		.join('');
};

const renderPresets = () => {
	el.presetCount.textContent = state.presets.length || '';

	if (!state.selectedSourceId) {
		el.presetList.innerHTML =
			'<p class="empty-line">Select a source first.</p>';
		return;
	}

	if (state.presets.length === 0) {
		el.presetList.innerHTML =
			'<p class="empty-line">Save a query to reuse it later.</p>';
		return;
	}

	el.presetList.innerHTML = state.presets
		.map(
			preset => `
				<div class="row">
					<button class="row-main" data-action="use-preset" data-id="${preset.id}" title="Load into the SQL editor">
						<span class="row-title">${escapeHtml(preset.name)}</span>
					</button>
					<button class="text-button" data-action="run-preset" data-id="${preset.id}" ${isBusy() ? 'disabled' : ''}>Run</button>
					<button class="danger text-button" data-action="delete-preset" data-id="${preset.id}">${confirmLabel(
						`preset:${preset.id}`,
						'Delete',
					)}</button>
				</div>
			`,
		)
		.join('');
};

const renderHistory = () => {
	el.clearContext.hidden = state.turns.length === 0;

	if (state.turns.length === 0) {
		el.historyList.innerHTML = `
			<p class="empty-line">Questions you ask are kept as context for follow-ups.</p>
		`;
		return;
	}

	el.historyList.innerHTML = state.turns
		.map(
			(turn, index) => `
				<div class="row">
					<button class="row-main" data-action="use-turn" data-id="${turn.id}" title="Reload this question and its SQL">
						<span class="row-index">${state.turns.length - index}</span>
						<span class="row-title row-title-clamp">${escapeHtml(turn.question)}</span>
					</button>
				</div>
			`,
		)
		.join('');
};

const matchesFilter = (table, columns, filter) => {
	if (!filter) return {matched: true, columns};
	if (table.toLowerCase().includes(filter)) return {matched: true, columns};
	const hits = columns.filter(column =>
		column.column.toLowerCase().includes(filter),
	);
	return {matched: hits.length > 0, columns: hits};
};

const renderSchema = () => {
	if (!state.selectedSourceId) {
		el.schemaCount.textContent = '';
		el.schemaList.innerHTML =
			'<p class="empty-line">Select a source to browse its schema.</p>';
		return;
	}

	if (state.schemaLoading) {
		el.schemaList.innerHTML = '<p class="empty-line">Loading schema…</p>';
		return;
	}

	if (state.schemaError) {
		el.schemaCount.textContent = '';
		el.schemaList.innerHTML = `<p class="empty-line danger-text">${escapeHtml(state.schemaError)}</p>`;
		return;
	}

	if (!state.schema) {
		el.schemaList.innerHTML = '';
		return;
	}

	const entries = Object.entries(state.schema);
	el.schemaCount.textContent = entries.length || '';

	const filter = state.schemaFilter.trim().toLowerCase();
	const rendered = entries
		.map(([table, columns]) => ({
			table,
			...matchesFilter(table, columns, filter),
		}))
		.filter(entry => entry.matched);

	if (rendered.length === 0) {
		el.schemaList.innerHTML = `<p class="empty-line">No tables match “${escapeHtml(state.schemaFilter)}”.</p>`;
		return;
	}

	el.schemaList.innerHTML = rendered
		.map(({table, columns}) => {
			const open = filter ? true : state.expandedTables.has(table);
			return `
				<div class="schema-table ${open ? 'is-open' : ''}">
					<button class="schema-toggle" data-action="toggle-table" data-id="${escapeHtml(table)}">
						<span class="chevron"></span>
						<span class="schema-name">${escapeHtml(table)}</span>
						<span class="rail-count">${columns.length}</span>
					</button>
					${
						open
							? `<div class="schema-columns">${columns
									.map(
										column =>
											`<span class="pill"><span class="pill-name">${escapeHtml(column.column)}</span><span class="pill-type">${escapeHtml(column.type)}</span></span>`,
									)
									.join('')}</div>`
							: ''
					}
				</div>
			`;
		})
		.join('');
};

const renderBanner = () => {
	const messages = [];

	if (state.status && !state.status.hasApiKey) {
		messages.push(
			'<div class="notice">Set <code>OPENROUTER_KEY</code> to generate SQL from questions. You can still write and run SQL by hand.</div>',
		);
	}

	if (state.error) {
		messages.push(
			`<div class="error"><span>${escapeHtml(state.error)}</span><button class="text-button" data-action="dismiss-error">Dismiss</button></div>`,
		);
	}

	el.banner.innerHTML = messages.join('');
};

const renderComposer = () => {
	const ready = Boolean(state.selectedSourceId);
	const canGenerate = ready && state.status?.hasApiKey !== false;
	const onboarding = state.status !== null && state.sources.length === 0;

	el.onboarding.hidden = !onboarding;
	el.queryForm.hidden = onboarding;

	el.queryInput.disabled = !canGenerate || isBusy();
	el.queryInput.placeholder = ready
		? 'Ask a question about your data…'
		: 'Select a data source to start';
	el.generateButton.disabled = !canGenerate || isBusy();
	el.generateButton.textContent =
		state.busy === 'generate' ? 'Generating…' : 'Generate SQL';

	el.composerStatus.innerHTML =
		state.busy === 'generate'
			? 'Asking the model for SQL <span class="elapsed">0s</span>'
			: state.turns.length > 0
				? `Follow-ups use the last ${plural(Math.min(state.turns.length, 5), 'question')} as context`
				: '';
};

const renderSqlPanel = () => {
	const visible = Boolean(state.pendingSql) || Boolean(state.selectedSourceId);
	el.sqlPanel.hidden = !visible;
	if (!visible) return;

	if (el.sqlEditor.value !== state.pendingSql) {
		el.sqlEditor.value = state.pendingSql;
	}

	el.sqlEditor.disabled = isBusy();
	el.sqlEditor.placeholder = 'SELECT * FROM …';
	el.runButton.disabled = isBusy() || !state.pendingSql.trim();
	el.runButton.textContent = state.busy === 'run' ? 'Running…' : 'Run query';
};

const isNumericColumn = (rows, column) => {
	const sample = rows.slice(0, 20).map(row => row[column]);
	const values = sample.filter(value => value !== null && value !== undefined);
	return values.length > 0 && values.every(value => typeof value === 'number');
};

const formatCell = value => {
	if (value === null || value === undefined)
		return '<span class="null">NULL</span>';
	if (typeof value === 'object')
		return escapeHtml(JSON.stringify(value, null, 2));
	if (typeof value === 'boolean') return `<span class="bool">${value}</span>`;
	return escapeHtml(value);
};

const renderResults = () => {
	if (state.busy === 'run') {
		el.results.innerHTML = `
			<div class="panel placeholder">
				<div>Running query… <span class="elapsed">0s</span></div>
				<div class="placeholder-sub">If the database rejects the SQL, the model rewrites and retries it up to twice.</div>
			</div>
		`;
		return;
	}

	if (!state.results) {
		el.results.innerHTML = state.selectedSourceId
			? '<div class="panel placeholder">Results appear here once you run a query.</div>'
			: '';
		return;
	}

	if (state.results.length === 0) {
		el.results.innerHTML =
			'<div class="panel placeholder">Query ran successfully and returned no rows.</div>';
		return;
	}

	const columns = Object.keys(state.results[0]);
	const rows = state.results.slice(0, MAX_RENDERED_ROWS);
	const alignment = Object.fromEntries(
		columns.map(column => [column, isNumericColumn(state.results, column)]),
	);
	const truncated = state.results.length > rows.length;

	el.results.innerHTML = `
		<section class="panel results-panel">
			<div class="panel-head results-head">
				<span class="eyebrow">${plural(state.results.length, 'row')}<span class="sep">/</span>${plural(columns.length, 'column')}${
					truncated
						? `<span class="sep">/</span>showing first ${MAX_RENDERED_ROWS}`
						: ''
				}</span>
				<div class="head-actions">
					<span class="tag tag-stale" id="stale-tag" hidden>SQL edited since this ran</span>
					<button class="text-button" data-action="download-csv">Download CSV</button>
					<button class="text-button" data-action="copy-json">Copy JSON</button>
				</div>
			</div>
			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							<th class="gutter"></th>
							${columns
								.map(
									column =>
										`<th class="${alignment[column] ? 'num' : ''}">${escapeHtml(column)}</th>`,
								)
								.join('')}
						</tr>
					</thead>
					<tbody>
						${rows
							.map(
								(row, index) =>
									`<tr><td class="gutter">${index + 1}</td>${columns
										.map(
											column =>
												`<td class="${alignment[column] ? 'num' : ''}">${formatCell(row[column])}</td>`,
										)
										.join('')}</tr>`,
							)
							.join('')}
					</tbody>
				</table>
			</div>
		</section>
	`;
	syncStaleTag();
};

const syncStaleTag = () => {
	const tag = document.querySelector('#stale-tag');
	if (!tag) return;
	tag.hidden = state.pendingSql.trim() === state.resultsSql.trim();
};

const renderActivity = () => {
	if (state.logs.length === 0) {
		el.activity.innerHTML = '';
		return;
	}

	el.activity.innerHTML = `
		<details class="activity">
			<summary>Activity<span class="rail-count">${state.logs.length}</span></summary>
			<div class="timeline">${state.logs.map(log => `<div>${escapeHtml(log)}</div>`).join('')}</div>
		</details>
	`;
};

const renderSectionStates = () => {
	for (const [section, open] of Object.entries(state.openSections)) {
		document
			.querySelector(`.rail[data-section="${section}"]`)
			?.classList.toggle('is-collapsed', !open);
	}
};

const render = () => {
	renderTopbar();
	renderSources();
	renderPresets();
	renderHistory();
	renderSchema();
	renderSectionStates();
	renderBanner();
	renderComposer();
	renderSqlPanel();
	renderResults();
	renderActivity();
};

const loadSources = async () => {
	const {sources} = await api('/api/sources');
	setState({sources});
	return sources;
};

const selectSource = async sourceId => {
	if (sourceId === state.selectedSourceId) return;

	setState({
		selectedSourceId: sourceId,
		schema: null,
		schemaError: '',
		schemaLoading: true,
		schemaFilter: '',
		expandedTables: new Set(),
		presets: [],
		results: null,
		pendingSql: '',
		logs: [],
		messages: [],
		turns: [],
		error: '',
	});
	el.schemaFilter.value = '';
	el.queryInput.value = '';

	try {
		const [schemaResult, presetResult] = await Promise.allSettled([
			api(`/api/sources/${sourceId}/schema`),
			api(`/api/sources/${sourceId}/presets`),
		]);

		if (sourceId !== state.selectedSourceId) return;

		setState({
			schema:
				schemaResult.status === 'fulfilled' ? schemaResult.value.schema : null,
			schemaError:
				schemaResult.status === 'rejected' ? schemaResult.reason.message : '',
			presets:
				presetResult.status === 'fulfilled' ? presetResult.value.presets : [],
			schemaLoading: false,
		});
	} catch (error) {
		setState({schemaLoading: false, error: error.message});
	}
};

const addSource = async event => {
	event.preventDefault();
	const form = new FormData(el.sourceForm);
	el.sourceDialogError.hidden = true;
	setState({busy: 'source'});

	try {
		const {source} = await api('/api/sources', {
			method: 'POST',
			body: JSON.stringify({
				name: form.get('name'),
				connectionString: form.get('connectionString'),
			}),
		});
		el.sourceForm.reset();
		el.sourceDialog.close();
		setState({sources: [...state.sources, source], busy: null});
		await selectSource(source.id);
	} catch (error) {
		el.sourceDialogError.textContent = error.message;
		el.sourceDialogError.hidden = false;
		setState({busy: null});
	}
};

const deleteSource = async sourceId => {
	if (state.confirming !== `source:${sourceId}`) {
		armConfirm(`source:${sourceId}`);
		return;
	}

	setState({busy: 'source', confirming: null});
	try {
		await api(`/api/sources/${sourceId}`, {method: 'DELETE'});
		const sources = state.sources.filter(source => source.id !== sourceId);
		setState({
			sources,
			selectedSourceId: null,
			schema: null,
			presets: [],
			results: null,
			pendingSql: '',
			turns: [],
			messages: [],
			busy: null,
		});
		if (sources.length > 0) await selectSource(sources[0].id);
	} catch (error) {
		setState({error: error.message, busy: null});
	}
};

const generateSql = async event => {
	event.preventDefault();
	const query = el.queryInput.value.trim();
	if (!query || !state.selectedSourceId || isBusy()) return;

	startElapsed();
	setState({
		busy: 'generate',
		error: '',
		logs: [],
		pendingSql: '',
		results: null,
	});
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
			pendingSql: result.sql || '',
			logs: result.logs || [],
			messages: [...state.messages, {role: 'user', content: query}],
			turns: [
				{id: crypto.randomUUID(), question: query, sql: result.sql || ''},
				...state.turns,
			],
			busy: null,
		});
		el.sqlEditor.focus();
	} catch (error) {
		setState({error: error.message, busy: null});
	} finally {
		stopElapsed();
	}
};

const executeSql = async () => {
	const sql = state.pendingSql.trim();
	if (!sql || !state.selectedSourceId || isBusy()) return;

	startElapsed();
	setState({busy: 'run', error: '', logs: [], results: null});
	try {
		const result = await api('/api/query/execute', {
			method: 'POST',
			body: JSON.stringify({sourceId: state.selectedSourceId, sql}),
		});
		if (result.error) throw new Error(result.error);

		const finalSql = result.sql || sql;
		setState({
			pendingSql: finalSql,
			resultsSql: finalSql,
			results: result.data || [],
			logs: result.logs || [],
			messages: [...state.messages, {role: 'assistant', content: finalSql}],
			turns: state.turns.map((turn, index) =>
				index === 0 ? {...turn, sql: finalSql} : turn,
			),
			busy: null,
		});
	} catch (error) {
		setState({error: error.message, busy: null});
	} finally {
		stopElapsed();
	}
};

const savePreset = async event => {
	event.preventDefault();
	const name = new FormData(el.presetForm).get('name')?.trim();
	const sql = state.pendingSql.trim();
	if (!name || !sql) return;

	el.presetDialogError.hidden = true;
	try {
		const {presets} = await api(
			`/api/sources/${state.selectedSourceId}/presets`,
			{method: 'POST', body: JSON.stringify({name, sql})},
		);
		el.presetForm.reset();
		el.presetDialog.close();
		setState({presets});
	} catch (error) {
		el.presetDialogError.textContent = error.message;
		el.presetDialogError.hidden = false;
	}
};

const deletePreset = async presetId => {
	if (state.confirming !== `preset:${presetId}`) {
		armConfirm(`preset:${presetId}`);
		return;
	}

	setState({confirming: null});
	try {
		await api(`/api/sources/${state.selectedSourceId}/presets/${presetId}`, {
			method: 'DELETE',
		});
		setState({presets: state.presets.filter(preset => preset.id !== presetId)});
	} catch (error) {
		setState({error: error.message});
	}
};

const downloadCsv = () => {
	if (!state.results?.length) return;

	const columns = Object.keys(state.results[0]);
	const cell = value => {
		if (value === null || value === undefined) return '';
		const text =
			typeof value === 'object' ? JSON.stringify(value) : String(value);
		return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
	};

	const csv = [
		columns.map(cell).join(','),
		...state.results.map(row =>
			columns.map(column => cell(row[column])).join(','),
		),
	].join('\n');

	const url = URL.createObjectURL(new Blob([csv], {type: 'text/csv'}));
	const link = document.createElement('a');
	link.href = url;
	link.download = `openinsight-${Date.now()}.csv`;
	link.click();
	URL.revokeObjectURL(url);
};

const flashButton = (button, label) => {
	const original = button.textContent;
	button.textContent = label;
	setTimeout(() => {
		button.textContent = original;
	}, 1200);
};

const copyToClipboard = async (text, button) => {
	try {
		await navigator.clipboard.writeText(text);
		flashButton(button, 'Copied');
	} catch {
		flashButton(button, 'Copy failed');
	}
};

const actions = {
	'toggle-section': button => {
		const section = button.dataset.section;
		setState({
			openSections: {
				...state.openSections,
				[section]: !state.openSections[section],
			},
		});
	},
	'toggle-table': button => {
		const table = button.dataset.id;
		const expanded = new Set(state.expandedTables);
		if (expanded.has(table)) expanded.delete(table);
		else expanded.add(table);
		setState({expandedTables: expanded});
	},
	'select-source': button => selectSource(button.dataset.id),
	'delete-source': button => deleteSource(button.dataset.id),
	'open-source-dialog': () => {
		el.sourceDialogError.hidden = true;
		el.sourceDialog.showModal();
	},
	'open-preset-dialog': () => {
		if (!state.pendingSql.trim()) return;
		el.presetDialogError.hidden = true;
		el.presetDialog.showModal();
	},
	'close-dialog': button => {
		document.querySelector(`#${button.dataset.dialog}`)?.close();
	},
	'use-preset': button => {
		const preset = state.presets.find(item => item.id === button.dataset.id);
		if (preset) setState({pendingSql: preset.sql, results: null, error: ''});
	},
	'run-preset': async button => {
		const preset = state.presets.find(item => item.id === button.dataset.id);
		if (!preset) return;
		setState({pendingSql: preset.sql, results: null, error: ''});
		await executeSql();
	},
	'delete-preset': button => deletePreset(button.dataset.id),
	'use-turn': button => {
		const turn = state.turns.find(item => item.id === button.dataset.id);
		if (!turn) return;
		el.queryInput.value = turn.question;
		setState({pendingSql: turn.sql, results: null, error: ''});
	},
	'clear-context': () => setState({turns: [], messages: []}),
	'dismiss-error': () => setState({error: ''}),
	'copy-sql': button => copyToClipboard(state.pendingSql, button),
	'copy-json': button =>
		copyToClipboard(JSON.stringify(state.results, null, 2), button),
	'download-csv': downloadCsv,
	'run-sql': executeSql,
};

document.addEventListener('click', event => {
	const button = event.target.closest('[data-action]');
	if (!button) return;
	const handler = actions[button.dataset.action];
	if (!handler) return;
	event.preventDefault();
	handler(button);
});

const submitOnMeta = (event, submit) => {
	if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
		event.preventDefault();
		submit();
	}
};

el.queryForm.addEventListener('submit', generateSql);
el.queryInput.addEventListener('keydown', event =>
	submitOnMeta(event, () => el.queryForm.requestSubmit()),
);
el.sqlEditor.addEventListener('input', event => {
	state.pendingSql = event.target.value;
	el.runButton.disabled = isBusy() || !state.pendingSql.trim();
	syncStaleTag();
});
el.sqlEditor.addEventListener('keydown', event =>
	submitOnMeta(event, executeSql),
);
el.schemaFilter.addEventListener('input', event => {
	state.schemaFilter = event.target.value;
	renderSchema();
});
el.sourceForm.addEventListener('submit', addSource);
el.presetForm.addEventListener('submit', savePreset);

const init = async () => {
	render();
	try {
		const status = await api('/api/status');
		setState({status});
		const sources = await loadSources();
		if (sources.length > 0) await selectSource(sources[0].id);
	} catch (error) {
		setState({error: error.message});
	}
};

init();
