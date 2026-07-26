import {expect, test} from 'bun:test';
import {copySelectionToClipboard} from '../source/utils/clipboard.js';

test('completed text selections are copied to the terminal clipboard', () => {
	let copiedText = null;
	const renderer = {
		copyToClipboardOSC52(text) {
			copiedText = text;
			return true;
		},
	};
	const selection = {
		isDragging: false,
		getSelectedText: () => 'selected\ntext',
	};

	expect(copySelectionToClipboard(renderer, selection)).toBe(true);
	expect(copiedText).toBe('selected\ntext');
});

test('empty and in-progress selections are not copied', () => {
	let copyCount = 0;
	const renderer = {
		copyToClipboardOSC52() {
			copyCount += 1;
			return true;
		},
	};

	expect(
		copySelectionToClipboard(renderer, {
			isDragging: true,
			getSelectedText: () => 'unfinished',
		}),
	).toBe(false);
	expect(
		copySelectionToClipboard(renderer, {
			isDragging: false,
			getSelectedText: () => '',
		}),
	).toBe(false);
	expect(copyCount).toBe(0);
});
