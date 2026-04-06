import test from 'ava';
import {getQueryCtrlCAction} from '../source/utils/query-quit.js';

test('Ctrl+C clears a non-empty query draft first', t => {
	t.is(
		getQueryCtrlCAction({
			inputValue: 'select users',
			isProcessing: false,
			awaitingQuitConfirmation: false,
		}),
		'clear-input',
	);
});

test('Ctrl+C starts quit confirmation when the input is empty', t => {
	t.is(
		getQueryCtrlCAction({
			inputValue: '',
			isProcessing: false,
			awaitingQuitConfirmation: false,
		}),
		'confirm-quit',
	);
});

test('second Ctrl+C quits once confirmation is active', t => {
	t.is(
		getQueryCtrlCAction({
			inputValue: '',
			isProcessing: false,
			awaitingQuitConfirmation: true,
		}),
		'quit',
	);
});

test('Ctrl+C is ignored while a query is processing', t => {
	t.is(
		getQueryCtrlCAction({
			inputValue: '',
			isProcessing: true,
			awaitingQuitConfirmation: false,
		}),
		'ignore',
	);
});
