import {test, expect} from 'bun:test';
import {
	getVisibleLineWindow,
	renderTranscriptLines,
	wrapText,
} from '../source/utils/transcript.js';

test('wrapText splits long lines by width', () => {
	expect(wrapText('abcdefgh', 3)).toEqual(['abc', 'def', 'gh']);
});

test('getVisibleLineWindow clamps scroll position and pads viewport', () => {
	const lines = [{segments: [{text: '1'}]}, {segments: [{text: '2'}]}];
	const window = getVisibleLineWindow(lines, 99, 4);

	expect(window.scrollTop).toBe(0);
	expect(window.maxScrollTop).toBe(0);
	expect(window.visibleLines.length).toBe(4);
	expect(window.visibleLines[0].segments[0].text).toBe('1');
	expect(window.visibleLines[1].segments[0].text).toBe('2');
});

test('renderTranscriptLines shows empty query results explicitly', () => {
	const lines = renderTranscriptLines(
		[
			{
				role: 'assistant',
				content: 'select * from users',
				data: null,
				resultCount: 0,
				moreRows: 0,
			},
		],
		{width: 40},
	);

	expect(
		lines.some(line =>
			line.segments.some(segment => segment.text.includes('No results')),
		),
	).toBe(true);
});

test('renderTranscriptLines wraps table cells without ellipsizing data', () => {
	const lines = renderTranscriptLines(
		[
			{
				role: 'assistant',
				content: 'select bio from users',
				data: [
					{
						name: 'Ada',
						bio: 'abcdefghijklmnopqrstuvwxyz',
					},
				],
				resultCount: 1,
				moreRows: 0,
			},
		],
		{width: 28},
	);
	const renderedText = lines
		.flatMap(line => line.segments.map(segment => segment.text))
		.join('\n');

	expect(renderedText).not.toContain('…');
	expect(renderedText).toContain('abcdefghijkl');
	expect(renderedText).toContain('uvwxyz');
});
