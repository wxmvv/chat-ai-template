const VALID_ROLES = new Set(['system', 'user', 'assistant', 'tool']);

const normalizeMessageContent = (content) => {
	if (typeof content === 'string') {
		return content;
	}

	if (Array.isArray(content)) {
		const text = content
			.map((part) => {
				if (part && part.type === 'text' && typeof part.text === 'string') return part.text;
				return '';
			})
			.join('');

		return text || null;
	}

	return null;
};

const normalizeMessages = (messages = []) => {
	if (!Array.isArray(messages)) {
		return [];
	}

	return messages.reduce((list, message) => {
		if (!message || !VALID_ROLES.has(message.role)) {
			return list;
		}

		const content = normalizeMessageContent(message.content);
		if (typeof content !== 'string') {
			return list;
		}

		const normalizedMessage = {
			role: message.role,
			content
		};

		if (typeof message.name === 'string') {
			normalizedMessage.name = message.name;
		}

		list.push(normalizedMessage);

		return list;
	}, []);
};

const normalizeSystemMessages = (system) => {
	if (!system) return [];

	if (typeof system === 'string') {
		return [{ role: 'system', content: system }];
	}

	if (Array.isArray(system)) {
		return normalizeMessages(system);
	}

	return normalizeMessages([system]);
};

const buildPromptMessages = ({ system, prompt, messages } = {}) => {
	if (prompt != null && messages != null) {
		throw new Error('Use either prompt or messages, not both.');
	}

	const systemMessages = normalizeSystemMessages(system);

	if (typeof prompt === 'string') {
		return normalizeMessages([
			...systemMessages,
			{ role: 'user', content: prompt }
		]);
	}

	return normalizeMessages([...systemMessages, ...(messages || [])]);
};

export { buildPromptMessages, normalizeMessages };
