const toNumberOrUndefined = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);

const createEmptyUsage = () => ({
	inputTokens: undefined,
	outputTokens: undefined,
	totalTokens: undefined
});

const withComputedTotal = (usage = {}) => {
	const inputTokens = toNumberOrUndefined(usage.inputTokens);
	const outputTokens = toNumberOrUndefined(usage.outputTokens);
	const totalTokens =
		toNumberOrUndefined(usage.totalTokens) ??
		(typeof inputTokens === 'number' && typeof outputTokens === 'number'
			? inputTokens + outputTokens
			: undefined);

	return {
		inputTokens,
		outputTokens,
		totalTokens
	};
};

const mergeUsage = (currentUsage = {}, nextUsage = {}) => {
	const current = withComputedTotal(currentUsage);
	const next = withComputedTotal(nextUsage);

	return withComputedTotal({
		inputTokens: next.inputTokens ?? current.inputTokens,
		outputTokens: next.outputTokens ?? current.outputTokens,
		totalTokens: next.totalTokens ?? current.totalTokens
	});
};

const aggregateUsage = (messages = []) => {
	let inputTokens = 0;
	let outputTokens = 0;
	let hasInput = false;
	let hasOutput = false;

	for (const message of messages) {
		if (!message || message.role !== 'assistant' || !message.usage) continue;

		const usage = withComputedTotal(message.usage);

		if (typeof usage.inputTokens === 'number') {
			inputTokens += usage.inputTokens;
			hasInput = true;
		}

		if (typeof usage.outputTokens === 'number') {
			outputTokens += usage.outputTokens;
			hasOutput = true;
		}
	}

	return withComputedTotal({
		inputTokens: hasInput ? inputTokens : undefined,
		outputTokens: hasOutput ? outputTokens : undefined
	});
};

const formatNumber = (value) => new Intl.NumberFormat('en-US').format(value);

const formatUsageLabel = (usage = {}) => {
	const normalized = withComputedTotal(usage);

	if (typeof normalized.totalTokens === 'number') {
		return `Tokens ${formatNumber(normalized.totalTokens)}`;
	}

	if (
		typeof normalized.inputTokens === 'number' &&
		typeof normalized.outputTokens === 'number'
	) {
		return `输入 ${formatNumber(normalized.inputTokens)} / 输出 ${formatNumber(
			normalized.outputTokens
		)}`;
	}

	if (typeof normalized.inputTokens === 'number') {
		return `输入 ${formatNumber(normalized.inputTokens)}`;
	}

	if (typeof normalized.outputTokens === 'number') {
		return `输出 ${formatNumber(normalized.outputTokens)}`;
	}

	return '';
};

export { aggregateUsage, createEmptyUsage, formatUsageLabel, mergeUsage, withComputedTotal };
