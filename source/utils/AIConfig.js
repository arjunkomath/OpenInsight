import process from 'node:process';

const DEFAULT_OPENROUTER_MODEL = 'google/gemini-2.5-flash';
const DEFAULT_CLAUDE_MODEL = 'opus';

export function resolveAIConfig({
	provider,
	verbose = false,
	diagnostics = verbose,
	logging = false,
	env = process.env,
	which = Bun.which,
} = {}) {
	const selectedProvider = (
		provider ||
		env.OPENINSIGHT_AI_PROVIDER ||
		'openrouter'
	).toLowerCase();

	if (selectedProvider === 'openrouter') {
		const apiKey = env.OPENROUTER_KEY;
		return {
			provider: selectedProvider,
			model: env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL,
			verbose,
			diagnostics,
			logging,
			apiKey,
			available: Boolean(apiKey),
			unavailableMessage: apiKey
				? null
				: 'OPENROUTER_KEY environment variable is required',
		};
	}

	if (selectedProvider === 'claude') {
		const binaryPath = which('claude');
		return {
			provider: selectedProvider,
			model: env.OPENINSIGHT_CLAUDE_MODEL || DEFAULT_CLAUDE_MODEL,
			verbose,
			diagnostics,
			logging,
			binaryPath,
			available: Boolean(binaryPath),
			unavailableMessage: binaryPath
				? null
				: 'Claude Code CLI is not installed or `claude` is not in PATH',
		};
	}

	throw new Error(
		`Unsupported AI provider "${selectedProvider}". Use "openrouter" or "claude".`,
	);
}

export function publicAIStatus(config) {
	return {
		provider: config.provider,
		model: config.model,
		verbose: config.verbose,
		logging: config.logging,
		available: config.available,
		unavailableMessage: config.unavailableMessage,
	};
}
