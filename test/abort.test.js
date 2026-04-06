import test from 'ava';
import {
	createAbortError,
	isAbortError,
	throwIfAborted,
} from '../source/utils/abort.js';

test('createAbortError marks the error as an abort', t => {
	const error = createAbortError('Inference cancelled');

	t.true(isAbortError(error));
	t.is(error.message, 'Inference cancelled');
});

test('throwIfAborted throws an AbortError when the signal is aborted', t => {
	const controller = new AbortController();
	controller.abort();

	const error = t.throws(() => {
		throwIfAborted(controller.signal, 'Query execution cancelled');
	});

	t.true(isAbortError(error));
	t.is(error.message, 'Query execution cancelled');
});

test('throwIfAborted does nothing for active signals', t => {
	const controller = new AbortController();

	t.notThrows(() => {
		throwIfAborted(controller.signal, 'Should not throw');
	});
});
