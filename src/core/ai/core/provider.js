import { buildPromptMessages } from './messages.js';
import { createJSONLineParser, createSSELineParser, streamText } from './stream.js';

const omitUndefined = (value = {}) => {
	return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
};

const resolveFetch = (customFetch) => {
	if (typeof customFetch === 'function') {
		return customFetch;
	}

	const globalFetch = globalThis.fetch;
	if (typeof globalFetch !== 'function') {
		throw new Error('Fetch API is not available in the current environment.');
	}

	if (typeof window !== 'undefined' && window.fetch === globalFetch) {
		return globalFetch.bind(window);
	}

	return globalFetch.bind(globalThis);
};

const createProvider = (definition, options = {}) => {
	const providerConfig = {
		providerId: definition.providerId,
		baseURL: options.baseURL || definition.baseURL,
		headers: options.headers || definition.headers || {},
		defaultModelId: options.defaultModelId || definition.defaultModelId,
		fetch: resolveFetch(options.fetch)
	};

	const buildHeaders = (callHeaders) =>
		omitUndefined({
			...providerConfig.headers,
			...callHeaders
		});

	const provider = {
		provider: providerConfig.providerId,
		defaultModelId: providerConfig.defaultModelId,
		languageModel(modelId = providerConfig.defaultModelId, modelOptions = {}) {
			if (!modelId) {
				throw new Error(
					`No model id configured for provider "${providerConfig.providerId}".`
				);
			}

			const model = {
				specificationVersion: 'v1',
				provider: providerConfig.providerId,
				modelId,
				streamText(options = {}) {
					const messages = buildPromptMessages(options);
					const headers = buildHeaders(options.headers);
					const body = definition.buildChatBody({
						modelId,
						messages,
						settings: options,
						providerOptions: {
							...modelOptions,
							...(options.providerOptions || {})
						}
					});

					return streamText({
						model,
						messages,
						body,
						headers,
						signal: options.abortSignal,
						fetch: providerConfig.fetch,
						endpoint: `${providerConfig.baseURL}${definition.chatPath}`,
						parseLine:
							definition.streamFormat === 'sse'
								? createSSELineParser()
								: createJSONLineParser(),
						extractParts: definition.extractStreamParts,
						onStart: options.onStart,
						onResponse: options.onResponse,
						onChunk: options.onChunk,
						onText: options.onText,
						onReasoning: options.onReasoning,
						onFinish: options.onFinish,
						onError: options.onError,
						onAbort: options.onAbort,
						onFinally: options.onFinally
					});
				}
			};

			return model;
		},
		async listModels(callOptions = {}) {
			const response = await providerConfig.fetch(
				`${providerConfig.baseURL}${definition.modelsPath}`,
				{
					method: 'GET',
					headers: buildHeaders(callOptions.headers)
				}
			);

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}

			const payload = await response.json();
			return definition.normalizeModelList(payload, providerConfig.providerId);
		},
		async getBalance(callOptions = {}) {
			if (!definition.balancePath || !definition.normalizeBalance) {
				return {
					object: 'balance',
					provider: providerConfig.providerId,
					data: null
				};
			}

			const response = await providerConfig.fetch(
				`${providerConfig.baseURL}${definition.balancePath}`,
				{
					method: 'GET',
					headers: buildHeaders(callOptions.headers)
				}
			);

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}

			const payload = await response.json();
			return definition.normalizeBalance(payload, providerConfig.providerId);
		}
	};

	return provider;
};

export { createProvider, omitUndefined, resolveFetch };
