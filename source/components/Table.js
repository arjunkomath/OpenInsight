import React from 'react';
import {Box, Text} from 'ink';

export default function Table({data}) {
	if (!data || data.length === 0) return null;

	const columns = Object.keys(data[0]);
	const colWidths = {};

	for (const col of columns) {
		colWidths[col] = col.length;
		for (const row of data) {
			const val = String(row[col] ?? '');
			if (val.length > colWidths[col]) {
				colWidths[col] = Math.min(val.length, 30);
			}
		}
	}

	const pad = (str, len) => {
		const s = String(str ?? '');
		return s.length > len ? s.slice(0, len - 1) + '…' : s.padEnd(len);
	};

	return (
		<Box flexDirection="column">
			<Box>
				{columns.map(col => (
					<Box key={col} marginRight={2}>
						<Text bold color="cyan">
							{pad(col, colWidths[col])}
						</Text>
					</Box>
				))}
			</Box>
			<Box>
				{columns.map(col => (
					<Box key={col} marginRight={2}>
						<Text dimColor>{'─'.repeat(colWidths[col])}</Text>
					</Box>
				))}
			</Box>
			{data.map((row, rowIndex) => (
				<Box key={rowIndex}>
					{columns.map(col => (
						<Box key={col} marginRight={2}>
							<Text>{pad(row[col], colWidths[col])}</Text>
						</Box>
					))}
				</Box>
			))}
		</Box>
	);
}
