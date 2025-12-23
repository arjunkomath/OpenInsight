import {generateObject} from 'ai';
import {createOpenRouter} from '@openrouter/ai-sdk-provider';
import {z} from 'zod';

const sqlResponseSchema = z.object({
	sql: z.string().describe('The SQL query to execute'),
});

export function createOpenRouterClient(apiKey, model, onLog) {
	if (!apiKey) {
		throw new Error('OpenRouter API key is required');
	}

	const log = message => {
		if (onLog) onLog(message);
	};

	const openrouter = createOpenRouter({
		apiKey,
	});

	return {
		generateSQL: (query, schema, history) =>
			generateSQL(openrouter, model, query, schema, history, log),
		fixSQL: (sql, error, schema) =>
			fixSQL(openrouter, model, sql, error, schema, log),
	};
}

async function generateSQL(
	openrouter,
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
Database schema: ${JSON.stringify(schema)}`;

	log(`[AI Request] User query: "${naturalLanguageQuery}"`);
	log(`[AI Request] Schema tables: ${Object.keys(schema).join(', ')}`);
	if (history.length > 0) {
		log(`[AI Request] Context: ${history.length} previous messages`);
	}

	const messages = [...history, {role: 'user', content: naturalLanguageQuery}];

	try {
		const {object, usage} = await generateObject({
			model: openrouter(model),
			schema: sqlResponseSchema,
			system: systemPrompt,
			messages,
			temperature: 0.3,
		});

		log(`[AI Response] Model: ${model}`);
		if (usage) {
			log(
				`[AI Response] Tokens: ${usage.promptTokens} prompt, ${usage.completionTokens} completion`,
			);
		}
		log(`[AI Response] Generated SQL: ${object.sql}`);

		if (!object.sql) {
			log('[AI Error] No SQL generated');

			return {sql: null, error: 'No SQL generated'};
		}

		return {sql: object.sql, error: null};
	} catch (error) {
		log(`[AI Error] ${error.message}`);
		return {sql: null, error: `Failed to generate SQL: ${error.message}`};
	}
}

async function fixSQL(openrouter, model, failedSql, errorMessage, schema, log) {
	const systemPrompt = `You are a SQL expert. Fix the SQL query based on the error message.
Return ONLY valid SQL queries that perform READ operations (SELECT, WITH).
NEVER generate INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, or any mutation operations.
Database schema: ${JSON.stringify(schema)}
IMPORTANT: Always wrap table and column names in double quotes to preserve case sensitivity (e.g., "User", "userId").`;

	log(`[AI Request] Fixing SQL error: ${errorMessage}`);

	try {
		const {object, usage} = await generateObject({
			model: openrouter(model),
			schema: sqlResponseSchema,
			system: systemPrompt,
			messages: [
				{
					role: 'user',
					content: `SQL Query:\n${failedSql}\n\nError:\n${errorMessage}\n\nPlease fix the query.`,
				},
			],
			temperature: 0.2,
		});

		if (usage) {
			log(
				`[AI Response] Tokens: ${usage.promptTokens} prompt, ${usage.completionTokens} completion`,
			);
		}
		log(`[AI Response] Fixed SQL: ${object.sql}`);

		if (!object.sql) {
			return {sql: null, error: 'No SQL generated'};
		}

		return {sql: object.sql, error: null};
	} catch (error) {
		log(`[AI Error] ${error.message}`);
		return {sql: null, error: `Failed to fix SQL: ${error.message}`};
	}
}
