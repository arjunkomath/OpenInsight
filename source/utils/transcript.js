const BLANK_LINE = {
	segments: [{text: ' '}],
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const createSegment = (text, style = {}) => ({
	text,
	...style,
});

const assignSegmentKeys = (lineKey, segments) =>
	segments.map((segment, index) => ({
		...segment,
		key: `${lineKey}-segment-${index}-${segment.text}`,
	}));

const createLine = (lineKey, ...segments) => ({
	key: lineKey,
	segments:
		segments.length > 0
			? assignSegmentKeys(lineKey, segments)
			: assignSegmentKeys(lineKey, BLANK_LINE.segments),
});

const pushSpacer = lines => {
	const lastLine = lines.at(-1);
	const isBlankLine =
		lastLine?.segments?.length === 1 && lastLine.segments[0].text === ' ';

	if (!isBlankLine && lines.length > 0) {
		lines.push(createLine(`spacer-${lines.length}`, ...BLANK_LINE.segments));
	}
};

const truncate = (text, width) => {
	if (width <= 0) {
		return '';
	}

	if (text.length <= width) {
		return text;
	}

	if (width === 1) {
		return '…';
	}

	return `${text.slice(0, width - 1)}…`;
};

const pad = (text, width) => truncate(text, width).padEnd(width, ' ');

export const wrapText = (value, width) => {
	const safeWidth = Math.max(width, 1);
	const text = String(value ?? '').replaceAll('\r\n', '\n');
	const chunks = [];

	for (const paragraph of text.split('\n')) {
		if (paragraph.length === 0) {
			chunks.push('');
			continue;
		}

		let remaining = paragraph;

		while (remaining.length > safeWidth) {
			chunks.push(remaining.slice(0, safeWidth));
			remaining = remaining.slice(safeWidth);
		}

		chunks.push(remaining);
	}

	return chunks.length > 0 ? chunks : [''];
};

const appendWrappedLines = (lines, text, width, style = {}) => {
	for (const line of wrapText(text, width)) {
		lines.push(
			createLine(
				`line-${lines.length}`,
				createSegment(pad(line, Math.max(width, 1)), style),
			),
		);
	}
};

const renderTableLines = (data, maxWidth) => {
	if (!data || data.length === 0) {
		return [];
	}

	const columns = Object.keys(data[0]);
	if (columns.length === 0) {
		return [];
	}

	const colWidths = {};
	for (const column of columns) {
		colWidths[column] = Math.min(column.length, 18);
		for (const row of data) {
			const value = String(row[column] ?? '');
			colWidths[column] = Math.min(
				Math.max(colWidths[column], value.length),
				18,
			);
		}
	}

	const buildRow = values =>
		truncate(
			values
				.map((value, index) => pad(value, colWidths[columns[index]]))
				.join('  '),
			maxWidth,
		);

	return [
		createLine(
			`table-${columns.join('-')}-header`,
			createSegment(buildRow(columns), {color: 'cyan', bold: true}),
		),
		createLine(
			`table-${columns.join('-')}-separator`,
			createSegment(
				truncate(
					columns.map(column => '─'.repeat(colWidths[column])).join('  '),
					maxWidth,
				),
				{dimColor: true},
			),
		),
		...data.map((row, rowIndex) =>
			createLine(
				`table-row-${rowIndex}`,
				createSegment(
					buildRow(columns.map(column => String(row[column] ?? ''))),
				),
			),
		),
	];
};

const renderBorderBox = (contentLines, width, borderColor) => {
	const innerWidth = Math.max(width - 2, 1);
	const lines = [
		createLine(
			`box-top-${borderColor}-${contentLines.length}`,
			createSegment(`╭${'─'.repeat(innerWidth)}╮`, {color: borderColor}),
		),
	];

	for (const [index, line] of contentLines.entries()) {
		const wrappedLines = wrapText(line.text, innerWidth);
		for (const [wrappedIndex, wrappedLine] of wrappedLines.entries()) {
			lines.push(
				createLine(
					`box-${borderColor}-${index}-${wrappedIndex}`,
					createSegment('│', {color: borderColor}),
					createSegment(pad(wrappedLine, innerWidth), {
						color: line.color,
						bold: line.bold,
						dimColor: line.dimColor,
					}),
					createSegment('│', {color: borderColor}),
				),
			);
		}
	}

	lines.push(
		createLine(
			`box-bottom-${borderColor}-${contentLines.length}`,
			createSegment(`╰${'─'.repeat(innerWidth)}╯`, {color: borderColor}),
		),
	);

	return lines;
};

const renderAssistantMessage = (message, width) => {
	const hasRows = Array.isArray(message.data) && message.data.length > 0;
	const boxLines = renderBorderBox(
		[
			{text: message.content, color: 'gray', dimColor: true},
			...(hasRows
				? renderTableLines(message.data, Math.max(width - 2, 1)).map(line => ({
						text: line.segments.map(segment => segment.text).join(''),
						color: line.segments[0]?.color,
						bold: line.segments[0]?.bold,
						dimColor: line.segments[0]?.dimColor,
				  }))
				: []),
			...(message.resultCount === 0
				? [{text: 'No results', dimColor: true}]
				: []),
			...(message.moreRows > 0
				? [{text: `(${message.moreRows} more rows)`, dimColor: true}]
				: []),
		],
		width,
		'gray',
	);

	return boxLines;
};

const renderConfirmMessage = (message, width) => [
	...renderBorderBox(
		[
			{text: message.content, color: 'white'},
			{text: 'Execute?', color: 'yellow', bold: true},
			{text: 'Press Y to run, N to cancel', dimColor: true},
		],
		width,
		'green',
	),
];

export const renderTranscriptLines = (messages, {width}) => {
	const contentWidth = Math.max(width, 12);
	const lines = [];

	for (const message of messages) {
		if (message.role === 'user') {
			appendWrappedLines(lines, `› ${message.content}`, contentWidth, {
				color: 'cyan',
				bold: true,
			});
			pushSpacer(lines);
			continue;
		}

		if (message.role === 'log') {
			appendWrappedLines(lines, `│ ${message.content}`, contentWidth, {
				color: 'gray',
			});
			continue;
		}

		if (message.role === 'assistant') {
			lines.push(...renderAssistantMessage(message, contentWidth));
			pushSpacer(lines);
			continue;
		}

		if (message.role === 'error') {
			appendWrappedLines(lines, `✗ ${message.content}`, contentWidth, {
				color: 'red',
			});
			pushSpacer(lines);
			continue;
		}

		if (message.role === 'system') {
			appendWrappedLines(lines, message.content, contentWidth, {
				color: 'yellow',
			});
			pushSpacer(lines);
			continue;
		}

		if (message.role === 'confirm') {
			lines.push(...renderConfirmMessage(message, contentWidth));
			pushSpacer(lines);
		}
	}

	const transcriptLines =
		lines.length > 0
			? lines
			: [
					createLine(
						'empty-transcript',
						createSegment('No messages yet.', {dimColor: true}),
					),
			  ];

	return transcriptLines.map((line, index) =>
		createLine(
			`line-${index}`,
			...line.segments.map(({key: _key, ...segment}) => segment),
		),
	);
};

export const getVisibleLineWindow = (lines, scrollTop, viewportHeight) => {
	const safeHeight = Math.max(viewportHeight, 1);
	const maxScrollTop = Math.max(lines.length - safeHeight, 0);
	const clampedTop = clamp(scrollTop, 0, maxScrollTop);
	const visibleLines = lines.slice(clampedTop, clampedTop + safeHeight);

	while (visibleLines.length < safeHeight) {
		visibleLines.push(
			createLine(`padding-${clampedTop}-${visibleLines.length}`),
		);
	}

	return {
		maxScrollTop,
		scrollTop: clampedTop,
		visibleLines,
	};
};

export const truncateStatus = (text, width) =>
	truncate(text, Math.max(width, 1));
