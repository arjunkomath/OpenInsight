import {test, expect} from 'bun:test';
import {publicAIStatus, resolveAIConfig} from '../source/utils/AIConfig.js';

test('resolveAIConfig preserves OpenRouter defaults', () => {
	const config = resolveAIConfig({env: {}, which: () => null});

	expect(config).toEqual({
		provider: 'openrouter',
		model: 'google/gemini-2.5-flash',
		verbose: false,
		apiKey: undefined,
		available: false,
		unavailableMessage: 'OPENROUTER_KEY environment variable is required',
	});
});

test('resolveAIConfig selects and verifies Claude', () => {
	const config = resolveAIConfig({
		provider: 'claude',
		verbose: true,
		env: {OPENINSIGHT_CLAUDE_MODEL: 'sonnet'},
		which: command => (command === 'claude' ? '/usr/bin/claude' : null),
	});

	expect(config).toEqual({
		provider: 'claude',
		model: 'sonnet',
		verbose: true,
		binaryPath: '/usr/bin/claude',
		available: true,
		unavailableMessage: null,
	});
});

test('publicAIStatus omits credentials and the resolved binary path', () => {
	const status = publicAIStatus({
		provider: 'claude',
		model: 'opus',
		verbose: true,
		binaryPath: '/secret/path/claude',
		apiKey: 'secret',
		available: true,
		unavailableMessage: null,
	});

	expect(status).toEqual({
		provider: 'claude',
		model: 'opus',
		verbose: true,
		available: true,
		unavailableMessage: null,
	});
});
