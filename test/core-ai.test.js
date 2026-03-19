import test from 'node:test';
import assert from 'node:assert/strict';

import {
	normalizeMessages,
	buildPromptMessages
} from '../src/core/ai/core/messages.js';
import {
	extractDeepSeekStreamParts,
	extractOllamaStreamParts
} from '../src/core/ai/core/stream-parts.js';
import { createProvider } from '../src/core/ai/core/provider.js';

test('buildPromptMessages combines system and prompt into normalized messages', () => {
	const messages = buildPromptMessages({
		system: 'You are concise.',
		prompt: 'Hello'
	});

	assert.deepEqual(messages, [
		{ role: 'system', content: 'You are concise.' },
		{ role: 'user', content: 'Hello' }
	]);
});

test('normalizeMessages preserves message order and drops invalid entries', () => {
	const messages = normalizeMessages([
		{ role: 'system', content: 'Rules' },
		null,
		{ role: 'user', content: 'Question' },
		{ role: 'assistant', content: ['unsupported'] },
		{ role: 'assistant', content: 'Answer' }
	]);

	assert.deepEqual(messages, [
		{ role: 'system', content: 'Rules' },
		{ role: 'user', content: 'Question' },
		{ role: 'assistant', content: 'Answer' }
	]);
});

test('extractDeepSeekStreamParts returns reasoning, text, and finish reason', () => {
	const reasoning = extractDeepSeekStreamParts({
		choices: [
			{
				delta: {
					reasoning_content: 'let me think'
				}
			}
		]
	});

	const text = extractDeepSeekStreamParts({
		choices: [
			{
				delta: {
					content: 'final answer'
				}
			}
		]
	});

	const finish = extractDeepSeekStreamParts({
		choices: [
			{
				delta: {},
				finish_reason: 'stop'
			}
		],
		usage: {
			prompt_tokens: 10,
			completion_tokens: 5,
			total_tokens: 15
		}
	});

	assert.deepEqual(reasoning, [{ type: 'reasoning', text: 'let me think' }]);
	assert.deepEqual(text, [{ type: 'text', text: 'final answer' }]);
	assert.deepEqual(finish, [
		{
			type: 'finish',
			finishReason: 'stop',
			usage: {
				inputTokens: 10,
				outputTokens: 5,
				totalTokens: 15
			}
		}
	]);
});

test('extractOllamaStreamParts returns reasoning, text, and finish reason', () => {
	const reasoning = extractOllamaStreamParts({
		message: {
			thinking: 'thinking',
			content: ''
		},
		done: false
	});

	const text = extractOllamaStreamParts({
		message: {
			thinking: '',
			content: 'answer'
		},
		done: false
	});

	const finish = extractOllamaStreamParts({
		done: true,
		done_reason: 'stop',
		prompt_eval_count: 12,
		eval_count: 8
	});

	assert.deepEqual(reasoning, [{ type: 'reasoning', text: 'thinking' }]);
	assert.deepEqual(text, [{ type: 'text', text: 'answer' }]);
	assert.deepEqual(finish, [
		{
			type: 'finish',
			finishReason: 'stop',
			usage: {
				inputTokens: 12,
				outputTokens: 8,
				totalTokens: 20
			}
		}
	]);
});

test('createProvider binds global fetch before calling provider methods', async () => {
	const originalFetch = globalThis.fetch;
	const originalWindow = globalThis.window;
	const calls = [];
	const fakeWindow = {};

	fakeWindow.fetch = async function (url) {
		if (this !== fakeWindow) {
			throw new TypeError('Illegal invocation');
		}

		calls.push(url);
		return {
			ok: true,
			async json() {
				return { object: 'list', data: [] };
			}
		};
	};

	globalThis.window = fakeWindow;
	globalThis.fetch = fakeWindow.fetch;

	try {
		const provider = createProvider({
			providerId: 'test',
			baseURL: 'https://example.com',
			defaultModelId: 'demo',
			headers: {},
			modelsPath: '/models',
			chatPath: '/chat',
			streamFormat: 'jsonl',
			buildChatBody() {
				return {};
			},
			extractStreamParts() {
				return [];
			},
			normalizeModelList(payload) {
				return payload;
			}
		});

		const result = await provider.listModels();

		assert.deepEqual(result, { object: 'list', data: [] });
		assert.deepEqual(calls, ['https://example.com/models']);
	} finally {
		globalThis.fetch = originalFetch;
		globalThis.window = originalWindow;
	}
});
