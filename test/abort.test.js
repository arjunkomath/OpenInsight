import {test, expect} from 'bun:test';
import {
	createAbortError,
	isAbortError,
	throwIfAborted,
} from '../source/utils/abort.js';

test('createAbortError marks the error as an abort', () => {
	const error = createAbortError('Inference cancelled');

	expect(isAbortError(error)).toBe(true);
	expect(error.message).toBe('Inference cancelled');
});

test('throwIfAborted throws an AbortError when the signal is aborted', () => {
	const controller = new AbortController();
	controller.abort();

	let thrown;
	try {
		throwIfAborted(controller.signal, 'Query execution cancelled');
	} catch (error) {
		thrown = error;
	}

	expect(isAbortError(thrown)).toBe(true);
	expect(thrown.message).toBe('Query execution cancelled');
});

test('throwIfAborted does nothing for active signals', () => {
	const controller = new AbortController();

	expect(() => {
		throwIfAborted(controller.signal, 'Should not throw');
	}).not.toThrow();
});
