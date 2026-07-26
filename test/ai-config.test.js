import {test, expect} from 'bun:test';
import {publicAIStatus, resolveAIConfig} from '../source/utils/AIConfig.js';

test('resolveAIConfig preserves OpenRouter defaults', () => {
	const config = resolveAIConfig({env: {}, which: () => null});

	expect(config).toEqual({
		provider: 'openrouter',
		model: 'google/gemini-2.5-flash',
		apiKey: undefined,
		available: false,
		unavailableMessage: 'OPENROUTER_KEY environment variable is required',
	});
});

test('resolveAIConfig selects and verifies Claude', () => {
	const config = resolveAIConfig({
		provider: 'claude',
		env: {OPENINSIGHT_CLAUDE_MODEL: 'sonnet'},
		which: command => (command === 'claude' ? '/usr/bin/claude' : null),
	});

	expect(config).toEqual({
		provider: 'claude',
		model: 'sonnet',
		binaryPath: '/usr/bin/claude',
		available: true,
		unavailableMessage: null,
	});
});

test('explicit provider overrides the environment and unknown providers fail', () => {
	expect(
		resolveAIConfig({
			provider: 'claude',
			env: {OPENINSIGHT_AI_PROVIDER: 'openrouter'},
			which: () => '/claude',
		}).provider,
	).toBe('claude');

	expect(() =>
		resolveAIConfig({
			env: {OPENINSIGHT_AI_PROVIDER: 'other'},
			which: () => null,
		}),
	).toThrow('Unsupported AI provider');
});

test('publicAIStatus omits credentials and the resolved binary path', () => {
	const status = publicAIStatus({
		provider: 'claude',
		model: 'opus',
		binaryPath: '/secret/path/claude',
		apiKey: 'secret',
		available: true,
		unavailableMessage: null,
	});

	expect(status).toEqual({
		provider: 'claude',
		model: 'opus',
		available: true,
		unavailableMessage: null,
	});
});
