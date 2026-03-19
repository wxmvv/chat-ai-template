import { createProvider, omitUndefined } from '../core/provider.js';
import { extractDeepSeekStreamParts } from '../core/stream-parts.js';

const deepseek = (options = {}) =>
	createProvider(
		{
			providerId: 'deepseek',
			baseURL: 'https://api.deepseek.com',
			defaultModelId: 'deepseek-chat',
			headers: {
				'Content-Type': 'application/json;charset=utf-8',
				Accept: 'application/json',
				Authorization: `Bearer ${import.meta.env.VITE_DEEPSEEK_API_KEY}`
			},
			chatPath: '/chat/completions',
			modelsPath: '/models',
			balancePath: '/user/balance',
			streamFormat: 'sse',
			buildChatBody({ modelId, messages, settings, providerOptions }) {
				return omitUndefined({
					model: modelId,
					stream: true,
					messages,
					temperature: settings.temperature,
					max_tokens: settings.maxOutputTokens,
					top_p: settings.topP,
					frequency_penalty: settings.frequencyPenalty,
					presence_penalty: settings.presencePenalty,
					stop: settings.stopSequences,
					seed: settings.seed,
					thinking:
						providerOptions.thinking === undefined
							? undefined
							: {
									type: providerOptions.thinking ? 'enabled' : 'disabled'
								},
					response_format: {
						type: 'text'
					}
				});
			},
			extractStreamParts: extractDeepSeekStreamParts,
			normalizeModelList(payload, providerId) {
				return {
					object: payload.object || 'list',
					provider: providerId,
					data: (payload.data || []).map((item) => ({
						id: item.id,
						object: item.object || 'model',
						created: item.created,
						ownedBy: item.owned_by,
						provider: providerId
					}))
				};
			},
			normalizeBalance(payload, providerId) {
				return {
					object: payload.object || 'balance',
					provider: providerId,
					data: payload.data || null
				};
			}
		},
		options
	);

export { deepseek };
