import {expect, test} from 'bun:test';
import {createOpenRouterClient} from '../source/utils/OpenRouterClient.js';

const createProvider = () => model => ({model});

test('OpenRouter client redacts its API key from verbose provider metadata', async () => {
	const apiKey = 'sk-or-secret';
	const logs = [];
	const client = createOpenRouterClient(
		apiKey,
		'test/model',
		message => logs.push(message),
		{
			verbose: true,
			createProvider,
			generate: async () => ({
				object: {sql: 'SELECT 1 LIMIT 1000'},
				usage: {inputTokens: 1, outputTokens: 2},
				finishReason: 'stop',
				warnings: [],
				providerMetadata: {debug: apiKey},
				request: {body: {debug: apiKey}},
				response: {headers: {'x-debug': apiKey}},
			}),
		},
	);

	const result = await client.generateSQL('show one', {users: []}, []);
	const output = logs.join('\n');
	expect(result).toEqual({sql: 'SELECT 1 LIMIT 1000', error: null});
	expect(output).toContain('[Verbose][OpenRouter] Generation result:');
	expect(output).toContain('<redacted-api-key>');
	expect(output).not.toContain(apiKey);
});

test('OpenRouter client redacts its API key from returned errors', async () => {
	const apiKey = 'sk-or-secret';
	const logs = [];
	const client = createOpenRouterClient(
		apiKey,
		'test/model',
		message => logs.push(message),
		{
			verbose: true,
			createProvider,
			generate: async () => {
				throw new Error(`Provider echoed ${apiKey}`);
			},
		},
	);

	const result = await client.generateSQL('show one', {}, []);
	expect(result.error).toContain('<redacted-api-key>');
	expect(result.error).not.toContain(apiKey);
	expect(logs.join('\n')).not.toContain(apiKey);
});
