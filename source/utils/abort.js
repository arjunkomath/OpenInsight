export function createAbortError(message = 'Operation cancelled') {
	const error = new Error(message);
	error.name = 'AbortError';
	return error;
}

export function isAbortError(error) {
	return Boolean(error) && error.name === 'AbortError';
}

export function throwIfAborted(abortSignal, message = 'Operation cancelled') {
	if (abortSignal?.aborted) {
		throw createAbortError(message);
	}
}
