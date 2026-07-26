const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

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

/** Format tabular query results as a compact fixed-width text table. */
export const formatTable = (data, maxWidth) => {
	if (!data || data.length === 0) {
		return '';
	}

	const columns = Object.keys(data[0]);
	if (columns.length === 0) {
		return '';
	}

	const gap = '  ';
	const availableWidth = Math.max(
		maxWidth - gap.length * (columns.length - 1),
		1,
	);
	const columnWidths = columns.map(column => {
		let width = Math.max(
			...wrapText(column, maxWidth).map(line => line.length),
		);

		for (const row of data) {
			const value = String(row[column] ?? '');
			const longestLine = Math.max(
				...wrapText(value, maxWidth).map(line => line.length),
			);
			width = Math.max(width, longestLine);
		}

		return Math.max(width, 1);
	});

	while (columnWidths.reduce((sum, width) => sum + width, 0) > availableWidth) {
		let widestIndex = 0;
		for (const [index, width] of columnWidths.entries()) {
			if (width > columnWidths[widestIndex]) {
				widestIndex = index;
			}
		}

		if (columnWidths[widestIndex] <= 1) {
			break;
		}

		columnWidths[widestIndex] -= 1;
	}

	const formatRow = values => {
		const wrappedCells = values.map((value, index) =>
			wrapText(value, columnWidths[index]),
		);
		const rowHeight = Math.max(...wrappedCells.map(lines => lines.length));

		return Array.from({length: rowHeight}, (_, rowLineIndex) =>
			wrappedCells
				.map((cellLines, columnIndex) =>
					pad(cellLines[rowLineIndex] ?? '', columnWidths[columnIndex]),
				)
				.join(gap),
		);
	};

	const lines = [
		...formatRow(columns),
		columns.map((_, index) => '─'.repeat(columnWidths[index])).join(gap),
		...data.flatMap(row =>
			formatRow(columns.map(column => String(row[column] ?? ''))),
		),
	];

	return lines.join('\n');
};

export const truncateStatus = (text, width) =>
	truncate(text, Math.max(width, 1));

export const getScrollWindow = (scrollTop, viewportHeight, contentHeight) => {
	const safeHeight = Math.max(viewportHeight, 1);
	const maxScrollTop = Math.max(contentHeight - safeHeight, 0);
	const clampedTop = clamp(scrollTop, 0, maxScrollTop);

	return {
		maxScrollTop,
		scrollTop: clampedTop,
		visibleStart: contentHeight === 0 ? 0 : clampedTop + 1,
		visibleEnd: Math.min(clampedTop + safeHeight, contentHeight),
	};
};
