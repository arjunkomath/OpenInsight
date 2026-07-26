import {test, expect} from 'bun:test';
import {
	formatTable,
	getScrollWindow,
	wrapText,
} from '../source/utils/transcript.js';

test('wrapText splits long lines by width', () => {
	expect(wrapText('abcdefgh', 3)).toEqual(['abc', 'def', 'gh']);
});

test('getScrollWindow clamps scroll position', () => {
	const window = getScrollWindow(99, 4, 2);

	expect(window.scrollTop).toBe(0);
	expect(window.maxScrollTop).toBe(0);
	expect(window.visibleStart).toBe(1);
	expect(window.visibleEnd).toBe(2);
});

test('formatTable includes empty-capable header and cell wrap without ellipsis', () => {
	const table = formatTable(
		[
			{
				name: 'Ada',
				bio: 'abcdefghijklmnopqrstuvwxyz',
			},
		],
		28,
	);

	expect(table).not.toContain('…');
	expect(table.replaceAll(/\s+/g, '')).toContain('abcdefghijklmnopqrstuvwxyz');
	expect(table).toContain('name');
	expect(table).toContain('bio');
});

test('formatTable returns empty string for empty data', () => {
	expect(formatTable([], 40)).toBe('');
	expect(formatTable(null, 40)).toBe('');
});
