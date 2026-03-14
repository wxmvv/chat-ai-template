const DefaultHeaders = {
	'Content-Type': 'application/json;charset=utf-8',
	Accept: 'application/json'
};
const DefaultAPI = 'http://localhost:11434/api/chat';
const DefaultModel = 'gemma3n';

const createChatStream = (config = {}) => {
	const {
		api = DefaultAPI,
		headers = DefaultHeaders,
		model = DefaultModel,
		onStart,
		onResponse,
		onToken,
		onError,
		onAbort,
		onThinkingStart,
		onThinkingEnd,
		onEnd,
		onFinally
	} = config;

	let controller = null;
	let reader = null;
	let streaming = false;

	const ask = async (question, extraPayload = {}) => {
		if (streaming) throw new Error('Stream already running');

		controller = new AbortController();
		streaming = true;
		onStart?.();

		try {
			const response = await fetch(api, {
				method: 'POST',
				signal: controller.signal,
				headers,
				body: JSON.stringify({
					model,
					stream: true,
					messages: [
						{
							role: 'system',
							content: 'You are a helpful assistant.'
						},
						{
							role: 'user',
							content: question
						}
					],
					temperature: 1,
					max_tokens: 4096,
					think: config?.thinking ? true : false,
					...extraPayload
				})
			});

			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			if (!response.body) throw new Error('No response body');
			onResponse?.(response);

			reader = response.body.getReader();
			const decoder = new TextDecoder('utf-8');
			let buffer = '';
			let loop = true;

			let inThinking = false;

			while (loop) {
				const result = await reader.read().catch(() => null);
				if (!result) break;

				const { done, value } = result;
				if (done) break;

				buffer += decoder.decode(value, { stream: true });

				const parts = buffer.split('\n');
				buffer = parts.pop() || '';

				for (const part of parts) {
					// if (!part.trim()) continue;
					const data = JSON.parse(part);
					if (data.done) {
						loop = false;
						break;
					}

					const thinking = data.message?.thinking;
					const content = data.message?.content;

					if (thinking) {
						if (!inThinking) {
							onThinkingStart?.();
							inThinking = true;
						}
						onToken?.(thinking, true);
						continue;
					}

					if (content) {
						if (inThinking) {
							onThinkingEnd?.();
							inThinking = false;
						}
						onToken?.(content, false);
					}
				}
			}
			finish();
		} catch (err) {
			if (err.name === 'AbortError') onAbort?.();
			else onError?.(err);
		} finally {
			try {
				reader?.releaseLock?.();
			} catch {}
			cleanup();
			onFinally?.();
		}
	};

	const chat = async (messages, extraPayload = {}) => {
		if (streaming) throw new Error('Stream already running');

		controller = new AbortController();
		streaming = true;
		onStart?.();

		try {
			const response = await fetch(api, {
				method: 'POST',
				signal: controller.signal,
				headers,
				body: JSON.stringify({
					model,
					stream: true,
					messages: messages,
					temperature: 1,
					max_tokens: 4096,
					think: config?.thinking ? true : false,
					...extraPayload
				})
			});

			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			if (!response.body) throw new Error('No response body');
			onResponse?.(response);

			reader = response.body.getReader();
			const decoder = new TextDecoder('utf-8');
			let buffer = '';
			let loop = true;

			let inThinking = false;

			while (loop) {
				const result = await reader.read().catch(() => null);
				if (!result) break;

				const { done, value } = result;
				if (done) break;

				buffer += decoder.decode(value, { stream: true });

				const parts = buffer.split('\n');
				buffer = parts.pop() || '';

				for (const part of parts) {
					// if (!part.trim()) continue;
					const data = JSON.parse(part);
					if (data.done) {
						loop = false;
						break;
					}

					const thinking = data.message?.thinking;
					const content = data.message?.content;

					if (thinking) {
						console.log(1);
						if (!inThinking) {
							console.log(3);
							onThinkingStart?.();
							inThinking = true;
						}
						onToken?.(thinking, true);
						continue;
					}

					if (content) {
						console.log(2);
						if (inThinking) {
							console.log(4);
							onThinkingEnd?.();
							inThinking = false;
						}
						onToken?.(content, false);
					}
				}
			}
			finish();
		} catch (err) {
			if (err.name === 'AbortError') onAbort?.();
			else onError?.(err);
		} finally {
			try {
				reader?.releaseLock?.();
			} catch {}
			cleanup();
			onFinally?.();
		}
	};

	const abort = () => {
		console.log('Aborting stream', controller);
		if (!streaming) return;
		controller?.abort();
		reader?.cancel()?.catch(() => {});
	};

	const finish = () => {
		cleanup();
		onEnd?.();
	};

	const cleanup = () => {
		streaming = false;
		controller = null;
		reader = null;
	};

	const isStreaming = () => streaming;

	return {
		ask,
		chat,
		abort,
		isStreaming
	};
};

const getModelList = async (headers = DefaultHeaders) => {
	const response = await fetch('http://localhost:11434/api/tags', {
		method: 'GET',
		headers: headers
	});
	if (!response.ok) throw new Error('Network response was not ok');

	const data = await response.json();

	return {
		object: 'list',
		data: data.models.map((item) => ({
			id: item.name,
			object: 'model'
		}))
	};
};

const getBalance = async (headers = DefaultHeaders) => {
	const response = await fetch('http://localhost:11434/api/tags', {
		method: 'GET',
		headers: headers
	});
	if (!response.ok) {
		throw new Error('Network response was not ok');
	}
	return response.json();
};

export const ollama = {
	createChatStream,
	getModelList,
	getBalance
};

export default ollama;
