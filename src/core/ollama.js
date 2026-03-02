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
		onEnd
	} = config;

	let controller = null;
	let reader = null;
	let streaming = false;

	const start = async (question, extraPayload = {}) => {
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
					thinking: false,
					...extraPayload
				})
			});

			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			onResponse?.(response);

			reader = response.body.getReader();
			const decoder = new TextDecoder('utf-8');
			let buffer = '';

			while (true) {
				// if (controller.signal?.aborted) return reader.cancel();
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });

				const parts = buffer.split('\n');
				buffer = parts.pop(); // 保留未完成行

				for (const part of parts) {
					const data = JSON.parse(part);
					if (data.done) finish();
					const content = data.message?.content;
					if (content) onToken?.(content);
				}
			}
			finish();
		} catch (err) {
			if (err.name === 'AbortError') onAbort?.();
			else onError?.(err);
			cleanup();
			onEnd?.();
		}
	};

	const abort = () => {
		console.log('Aborting stream', controller);
		if (!streaming) return;
		controller?.abort();
		reader?.cancel();
		cleanup();
		onEnd?.();
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
		start,
		abort,
		isStreaming
	};
};

const getModelList = async (headers = DefaultHeaders) => {
	const response = await fetch('https://api.deepseek.com/models', {
		method: 'GET',
		headers: headers
	});
	if (!response.ok) {
		throw new Error('Network response was not ok');
	}
	return response.json();
};

const getBalance = async (headers = DefaultHeaders) => {
	const response = await fetch('https://api.deepseek.com/user/balance', {
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
