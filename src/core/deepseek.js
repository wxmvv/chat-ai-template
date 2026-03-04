const DefaultHeaders = {
	'Content-Type': 'application/json;charset=utf-8',
	Accept: 'application/json',
	Authorization: `Bearer your-ds-key`
};
const DefaultAPI = 'https://api.deepseek.com/chat/completions';
const DefaultModel = 'deepseek-chat';

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
					thinking: {
						type: 'disabled'
					},
					frequency_penalty: 0,
					presence_penalty: 0,
					response_format: {
						type: 'text'
					},
					stop: null,
					stream_options: null,
					top_p: 1,
					tools: null,
					tool_choice: 'none',
					logprobs: false,
					top_logprobs: null,
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
					if (!part.startsWith('data: ')) continue;
					if (part.includes('[DONE]')) {
						loop = false;
						break;
					}

					const data = JSON.parse(part.slice(6));
					const content = data.choices?.[0]?.delta?.content;

					if (content) onToken?.(content);
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
			onEnd?.();
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
	if (!response.ok) throw new Error('Network response was not ok');

	const data = await response.json();

	return data;
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

export const deepseek = {
	createChatStream,
	getModelList,
	getBalance
};

export default deepseek;
