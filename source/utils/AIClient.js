import {createClaudeCliClient} from './ClaudeCliClient.js';
import {createOpenRouterClient} from './OpenRouterClient.js';

export function createAIClient(config, onLog) {
	if (!config?.available) {
		throw new Error(config?.unavailableMessage || 'AI provider is unavailable');
	}

	if (config.provider === 'claude') {
		return createClaudeCliClient(config.binaryPath, config.model, onLog, {
			verbose: config.diagnostics,
		});
	}

	if (config.provider === 'openrouter') {
		return createOpenRouterClient(config.apiKey, config.model, onLog, {
			verbose: config.diagnostics,
		});
	}

	throw new Error(`Unsupported AI provider "${config.provider}"`);
}
