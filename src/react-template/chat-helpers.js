const getDropdownPosition = ({
	rect,
	menuWidth,
	menuHeight,
	viewportWidth,
	viewportHeight,
	gap = 4,
	padding = 10
}) => {
	let left = rect.left;
	let top = rect.bottom + gap;

	if (left + menuWidth > viewportWidth) {
		left = rect.right - menuWidth;
	}

	if (top + menuHeight > viewportHeight) {
		top = rect.top - menuHeight - gap;
	}

	if (left < 0) {
		left = padding;
	}

	if (top < 0) {
		top = padding;
	}

	return { left, top };
};

const isSafeToFlush = (text) => {
	let inCodeBlock = false;
	let fence = null;

	const fences = text.match(/(```|~~~)/g);

	if (fences) {
		for (let i = 0; i < fences.length; i += 1) {
			if (!inCodeBlock) {
				inCodeBlock = true;
				fence = fences[i];
			} else if (fences[i] === fence) {
				inCodeBlock = false;
				fence = null;
			}
		}
	}

	if (inCodeBlock) return false;
	if (text.includes('\n\n')) return true;

	const lines = text.split('\n');
	const lastLine = lines[lines.length - 1];
	const prevLine = lines[lines.length - 2] || '';
	const listPattern = /^(\s*)([-*+]|\d+\.)\s+/;

	const isPrevLineList = listPattern.test(prevLine);
	const isLastLineList = listPattern.test(lastLine);

	if (isPrevLineList && lastLine === '') {
		return false;
	}

	if (isPrevLineList && isLastLineList) {
		return false;
	}

	if (text.endsWith('\n')) {
		return true;
	}

	return false;
};

const checkIfAtBottom = (scrollTop, clientHeight, scrollHeight) =>
	scrollTop + clientHeight >= scrollHeight - 80;

const getConversationRecordId = (conversation) =>
	conversation?.conversation_id || conversation?.id || null;

const sortConversationIds = (ids, conversations) =>
	[...ids].sort((a, b) => {
		const ca = conversations.get(a);
		const cb = conversations.get(b);

		if (ca?.pinned && !cb?.pinned) return -1;
		if (!ca?.pinned && cb?.pinned) return 1;

		const ta = ca?.updated_time || ca?.created_time || 0;
		const tb = cb?.updated_time || cb?.created_time || 0;

		return tb - ta;
	});

export {
	checkIfAtBottom,
	getConversationRecordId,
	getDropdownPosition,
	isSafeToFlush,
	sortConversationIds
};
