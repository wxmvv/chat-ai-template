import { withComputedTotal } from './token-usage.js';

const normalizeFinishReason = (value) => {
	switch (value) {
		case 'stop':
		case 'length':
		case 'content-filter':
		case 'tool-calls':
		case 'error':
			return value;
		default:
			return 'other';
	}
};

const normalizeUsage = ({ inputTokens, outputTokens, totalTokens }) =>
	withComputedTotal({
		inputTokens,
		outputTokens,
		totalTokens
	});

const extractDeepSeekStreamParts = (payload = {}) => {
	const choice = payload.choices?.[0] || {};
	const delta = choice.delta || {};
	const parts = [];

	if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) {
		parts.push({
			type: 'reasoning',
			text: delta.reasoning_content
		});
	}

	if (typeof delta.content === 'string' && delta.content) {
		parts.push({
			type: 'text',
			text: delta.content
		});
	}

	if (choice.finish_reason) {
		parts.push({
			type: 'finish',
			finishReason: normalizeFinishReason(choice.finish_reason),
			usage: normalizeUsage({
				inputTokens: payload.usage?.prompt_tokens,
				outputTokens: payload.usage?.completion_tokens
			})
		});
	}

	return parts;
};

const extractOllamaStreamParts = (payload = {}) => {
	const parts = [];
	const message = payload.message || {};

	if (typeof message.thinking === 'string' && message.thinking) {
		parts.push({
			type: 'reasoning',
			text: message.thinking
		});
	}

	if (typeof message.content === 'string' && message.content) {
		parts.push({
			type: 'text',
			text: message.content
		});
	}

	if (payload.done) {
		parts.push({
			type: 'finish',
			finishReason: normalizeFinishReason(payload.done_reason || 'stop'),
			usage: normalizeUsage({
				inputTokens: payload.prompt_eval_count,
				outputTokens: payload.eval_count
			})
		});
	}

	return parts;
};

export {
	extractDeepSeekStreamParts,
	extractOllamaStreamParts,
	normalizeFinishReason,
	normalizeUsage
};
