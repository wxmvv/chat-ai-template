import { createProvider, omitUndefined } from '../core/provider.js';
import { extractOllamaStreamParts } from '../core/stream-parts.js';

const buildOllamaOptions = (settings = {}) => {
	return omitUndefined({
		temperature: settings.temperature,
		top_p: settings.topP,
		top_k: settings.topK,
		seed: settings.seed,
		stop: settings.stopSequences,
		num_predict: settings.maxOutputTokens
	});
};

const ollama = (options = {}) =>
	createProvider(
		{
			providerId: 'ollama',
			baseURL: 'http://localhost:11434',
			defaultModelId: 'gemma3n',
			headers: {
				'Content-Type': 'application/json;charset=utf-8',
				Accept: 'application/json'
			},
			chatPath: '/api/chat',
			modelsPath: '/api/tags',
			streamFormat: 'jsonl',
			buildChatBody({ modelId, messages, settings, providerOptions }) {
				const request = omitUndefined({
					model: modelId,
					stream: true,
					messages,
					think:
						providerOptions.thinking === undefined
							? undefined
							: Boolean(providerOptions.thinking)
				});

				const options = buildOllamaOptions(settings);
				if (Object.keys(options).length > 0) {
					request.options = options;
				}

				return request;
			},
			extractStreamParts: extractOllamaStreamParts,
			normalizeModelList(payload, providerId) {
				return {
					object: 'list',
					provider: providerId,
					data: (payload.models || []).map((item) => ({
						id: item.model || item.name,
						object: 'model',
						created: item.modified_at ? Date.parse(item.modified_at) : undefined,
						ownedBy: 'ollama',
						provider: providerId
					}))
				};
			}
		},
		options
	);

export { ollama };
