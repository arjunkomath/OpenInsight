import test from 'ava';
import {
	getVisibleLineWindow,
	renderTranscriptLines,
	wrapText,
} from '../source/utils/transcript.js';

test('wrapText splits long lines by width', t => {
	t.deepEqual(wrapText('abcdefgh', 3), ['abc', 'def', 'gh']);
});

test('getVisibleLineWindow clamps scroll position and pads viewport', t => {
	const lines = [{segments: [{text: '1'}]}, {segments: [{text: '2'}]}];
	const window = getVisibleLineWindow(lines, 99, 4);

	t.is(window.scrollTop, 0);
	t.is(window.maxScrollTop, 0);
	t.is(window.visibleLines.length, 4);
	t.is(window.visibleLines[0].segments[0].text, '1');
	t.is(window.visibleLines[1].segments[0].text, '2');
});

test('renderTranscriptLines shows empty query results explicitly', t => {
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

	t.true(
		lines.some(line =>
			line.segments.some(segment => segment.text.includes('No results')),
		),
	);
});
