const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export function createOpenRouterClient(apiKey, model, onLog) {
	if (!apiKey) {
		throw new Error('OpenRouter API key is required');
	}

	const log = message => {
		if (onLog) onLog(message);
	};

	return {
		generateSQL: (query, schema, history) =>
			generateSQL(apiKey, model, query, schema, history, log),
		fixSQL: (sql, error, schema) =>
			fixSQL(apiKey, model, sql, error, schema, log),
	};
}

async function generateSQL(
	apiKey,
	model,
	naturalLanguageQuery,
	schema,
	history,
	log,
) {
	const systemPrompt = `You are a SQL expert. Convert natural language queries to SQL.
Return ONLY valid SQL queries that perform READ operations (SELECT, WITH, UNION, etc.).
NEVER generate INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, or any mutation operations.
IMPORTANT: Always wrap table AND column names in double quotes to preserve case sensitivity (e.g., "User"."userId", "Order"."createdAt").
Database schema: ${JSON.stringify(schema)}
Respond with ONLY the SQL query, no explanation or markdown.`;

	log(`[AI Request] User query: "${naturalLanguageQuery}"`);
	log(`[AI Request] Schema tables: ${Object.keys(schema).join(', ')}`);
	if (history.length > 0) {
		log(`[AI Request] Context: ${history.length} previous messages`);
	}

	const messages = [
		{role: 'system', content: systemPrompt},
		...history,
		{role: 'user', content: naturalLanguageQuery},
	];

	try {
		const response = await fetch(OPENROUTER_API_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiKey}`,
				'HTTP-Referer': 'https://openinsight.techulus.xyz',
				'X-Title': 'OpenInsight',
			},
			body: JSON.stringify({
				model,
				messages,
				temperature: 0.3,
				max_tokens: 500,
			}),
		});

		if (!response.ok) {
			const errorData = await response.json();
			const errorMsg = `OpenRouter API error: ${
				errorData.error?.message || response.statusText
			}`;
			log(`[AI Error] ${errorMsg}`);
			return {sql: null, error: errorMsg};
		}

		const data = await response.json();
		const sql = data.choices[0]?.message?.content?.trim();
		const responseModel = data.model || 'unknown';
		const usage = data.usage;

		log(`[AI Response] Model: ${responseModel}`);
		if (usage) {
			log(
				`[AI Response] Tokens: ${usage.prompt_tokens} prompt, ${usage.completion_tokens} completion`,
			);
		}
		log(`[AI Response] Generated SQL: ${sql}`);

		if (!sql) {
			log('[AI Error] No SQL generated');
			return {sql: null, error: 'No SQL generated'};
		}

		return {sql, error: null};
	} catch (error) {
		log(`[AI Error] ${error.message}`);
		return {sql: null, error: `Failed to generate SQL: ${error.message}`};
	}
}

async function fixSQL(apiKey, model, failedSql, errorMessage, schema, log) {
	const systemPrompt = `You are a SQL expert. Fix the SQL query based on the error message.
Return ONLY valid SQL queries that perform READ operations (SELECT, WITH).
NEVER generate INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, or any mutation operations.
Database schema: ${JSON.stringify(schema)}
IMPORTANT: Always wrap table and column names in double quotes to preserve case sensitivity (e.g., "User", "userId").
Respond with ONLY the corrected SQL query, no explanation or markdown.`;

	log(`[AI Request] Fixing SQL error: ${errorMessage}`);

	try {
		const response = await fetch(OPENROUTER_API_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiKey}`,
				'HTTP-Referer': 'https://openinsight.techulus.xyz',
				'X-Title': 'OpenInsight',
			},
			body: JSON.stringify({
				model,
				messages: [
					{role: 'system', content: systemPrompt},
					{
						role: 'user',
						content: `SQL Query:\n${failedSql}\n\nError:\n${errorMessage}\n\nPlease fix the query.`,
					},
				],
				temperature: 0.2,
				max_tokens: 500,
			}),
		});

		if (!response.ok) {
			const errorData = await response.json();
			return {
				sql: null,
				error: `OpenRouter API error: ${
					errorData.error?.message || response.statusText
				}`,
			};
		}

		const data = await response.json();
		const sql = data.choices[0]?.message?.content?.trim();

		log(`[AI Response] Fixed SQL: ${sql}`);

		if (!sql) {
			return {sql: null, error: 'No SQL generated'};
		}

		return {sql, error: null};
	} catch (error) {
		log(`[AI Error] ${error.message}`);
		return {sql: null, error: `Failed to fix SQL: ${error.message}`};
	}
}
