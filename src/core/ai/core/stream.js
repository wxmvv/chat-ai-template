import { createEmptyUsage, mergeUsage } from './token-usage.js';

const createAbortError = () => {
	try {
		return new DOMException('The operation was aborted.', 'AbortError');
	} catch {
		const error = new Error('The operation was aborted.');
		error.name = 'AbortError';
		return error;
	}
};

const createLinkedAbortController = (externalSignal) => {
	const controller = new AbortController();

	if (!externalSignal) {
		return controller;
	}

	if (externalSignal.aborted) {
		controller.abort(externalSignal.reason);
		return controller;
	}

	const abort = () => controller.abort(externalSignal.reason);
	externalSignal.addEventListener('abort', abort, { once: true });

	return controller;
};

const splitStreamBuffer = (buffer) => {
	const lines = buffer.split('\n');
	return {
		lines: lines.slice(0, -1),
		rest: lines[lines.length - 1] || ''
	};
};

const processTextStream = async ({ response, parseLine, onItem }) => {
	const reader = response.body?.getReader();
	if (!reader) {
		throw new Error('No response body');
	}

	const decoder = new TextDecoder('utf-8');
	let buffer = '';

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const { lines, rest } = splitStreamBuffer(buffer);
			buffer = rest;

			for (const line of lines) {
				const parsed = parseLine(line);
				if (parsed == null) continue;
				await onItem(parsed);
			}
		}

		buffer += decoder.decode();

		if (buffer.trim()) {
			const parsed = parseLine(buffer);
			if (parsed != null) {
				await onItem(parsed);
			}
		}
	} finally {
		try {
			reader.releaseLock();
		} catch {}
	}
};

const createSSELineParser = () => {
	return (line) => {
		const trimmed = line.trim();
		if (!trimmed || !trimmed.startsWith('data:')) {
			return null;
		}

		const data = trimmed.slice(5).trim();
		if (!data || data === '[DONE]') {
			return null;
		}

		return JSON.parse(data);
	};
};

const createJSONLineParser = () => {
	return (line) => {
		const trimmed = line.trim();
		if (!trimmed) {
			return null;
		}

		return JSON.parse(trimmed);
	};
};

const streamText = ({
	model,
	messages,
	body,
	headers,
	signal,
	fetch: fetcher = fetch,
	endpoint,
	parseLine,
	extractParts,
	onStart,
	onResponse,
	onChunk,
	onText,
	onReasoning,
	onFinish,
	onError,
	onAbort,
	onFinally
}) => {
	const controller = createLinkedAbortController(signal);
	let streaming = true;

	const completion = (async () => {
		const result = {
			provider: model.provider,
			modelId: model.modelId,
			messages,
			text: '',
			reasoning: '',
			finishReason: 'other',
			usage: createEmptyUsage()
		};

		try {
			onStart?.({
				model: {
					provider: model.provider,
					modelId: model.modelId
				},
				messages
			});

			const response = await fetcher(endpoint, {
				method: 'POST',
				headers,
				body: JSON.stringify(body),
				signal: controller.signal
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}

			onResponse?.(response);

			await processTextStream({
				response,
				parseLine,
				onItem: async (item) => {
					const parts = extractParts(item);

					for (const part of parts) {
						onChunk?.(part);

						if (part.type === 'reasoning') {
							result.reasoning += part.text;
							onReasoning?.(part.text, part);
							continue;
						}

						if (part.type === 'text') {
							result.text += part.text;
							onText?.(part.text, part);
							continue;
						}

						if (part.type === 'finish') {
							result.finishReason = part.finishReason;
							result.usage = mergeUsage(result.usage, part.usage);
						}
					}
				}
			});

			onFinish?.(result);
			return result;
		} catch (error) {
			if (error?.name === 'AbortError') {
				onAbort?.();
			} else {
				onError?.(error);
			}

			throw error;
		} finally {
			streaming = false;
			onFinally?.();
		}
	})();

	return {
		provider: model.provider,
		modelId: model.modelId,
		abort() {
			if (!streaming) return;
			controller.abort(createAbortError());
		},
		isStreaming() {
			return streaming;
		},
		completion
	};
};

export {
	createAbortError,
	createJSONLineParser,
	createLinkedAbortController,
	createSSELineParser,
	streamText
};
