import {test, expect} from 'bun:test';
import {getQueryCtrlCAction} from '../source/utils/query-quit.js';

test('Ctrl+C clears a non-empty query draft first', () => {
	expect(
		getQueryCtrlCAction({
			inputValue: 'select users',
			isProcessing: false,
			awaitingQuitConfirmation: false,
		}),
	).toBe('clear-input');
});

test('Ctrl+C starts quit confirmation when the input is empty', () => {
	expect(
		getQueryCtrlCAction({
			inputValue: '',
			isProcessing: false,
			awaitingQuitConfirmation: false,
		}),
	).toBe('confirm-quit');
});

test('second Ctrl+C quits once confirmation is active', () => {
	expect(
		getQueryCtrlCAction({
			inputValue: '',
			isProcessing: false,
			awaitingQuitConfirmation: true,
		}),
	).toBe('quit');
});

test('Ctrl+C is ignored while a query is processing', () => {
	expect(
		getQueryCtrlCAction({
			inputValue: '',
			isProcessing: true,
			awaitingQuitConfirmation: false,
		}),
	).toBe('ignore');
});
