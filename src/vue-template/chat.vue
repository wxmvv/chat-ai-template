<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeMount, onBeforeUnmount } from 'vue';
import ArrowUp from '../icon/arrowUp.svg?component';
import ArrowDown from '../icon/arrowDown.svg?component';
import Plus from '../icon/plus.svg?component';
import Stop from '../icon/stop.svg?component';
import Copy from '../icon/copy.svg?component';
import Checkmark from '../icon/checkmark.svg?component';
import Refresh from '../icon/refresh.svg?component';
import Delete from '../icon/delete.svg?component';
import Edit from '../icon/edit.svg?component';
import Share from '../icon/share.svg?component';
import Zan from '../icon/zan.svg?component';
import Cai from '../icon/cai.svg?component';
import Zan_fill from '../icon/zan_fill.svg?component';
import Cai_fill from '../icon/cai_fill.svg?component';
import ChevronDown from '../icon/chevron_down.svg?component';
import Star from '../icon/star.svg?component';
import Gpt from '../icon/gpt.svg?component';
import More from '../icon/more.svg?component';
import Sidebar from '../icon/sidebar.svg?component';
import NewConversation from '../icon/new_conversation.svg?component';
import SidebarLeft from '../icon/sidebar_left.svg?component';
import OllamaHello from '../icon/ollama.svg?component';
import Websearch from '../icon/websearch.svg?component';
import Pic from '../icon/pic.svg?component';
import FileSvg from '../icon/file.svg?component';
import Think from '../icon/think.svg?component';
import Pin from '../icon/pin.svg?component';
import Pin_fill from '../icon/pin_fill.svg?component';

const VUE_TITLE = 'vue-chat-ai-demo';

// markdown 渲染 code 高亮
import hljs from 'highlight.js/lib/common';
import '../core/hljs-github.css';
import markdownit from 'markdown-it';
const md = markdownit({
	html: false,
	xhtmlOut: true,
	breaks: true,
	langPrefix: '',
	linkify: true,
	typographer: true,

	highlight: function (str, lang) {
		try {
			if (!lang || !hljs.getLanguage(lang)) {
				const result = hljs.highlightAuto(str);
				return `<pre><code class="hljs">${result.value}</code></pre>`;
			}

			const result = hljs.highlight(str, {
				language: lang,
				ignoreIllegals: true
			});

			return `<pre><code class="hljs ${lang}">${result.value}</code></pre>`;
		} catch (err) {
			console.warn('[highlight error]', err);
			return (
				`<pre><code class="hljs plaintext">` + md.utils.escapeHtml(str) + `</code></pre>`
			);
		}
	}
}).enable('table');

// provider model utils
import { deepseek, ollama } from '../core/ai';
import {
	aggregateUsage,
	createEmptyUsage,
	formatUsageLabel,
	mergeUsage
} from '../core/ai/core/token-usage.js';
import { UUID, downloadJSON, formatTime, importFile } from '../core/utils';

const providerList = [
	{
		name: 'deepseek',
		client: deepseek(),
		icon: () => Gpt,
		desc: '深度求索！'
	},
	{
		name: 'ollama',
		client: ollama(),
		icon: () => Star,
		desc: '本地小羊驼🦙'
	}
];
const provider = ref(providerList[1]);
const modelList = ref(null);
const model = ref(null);
const getActiveProvider = () => provider.value?.client || null;
const getActiveModelId = () => model.value?.id || getActiveProvider()?.defaultModelId || null;
const getActiveLanguageModel = () => {
	const currentProvider = getActiveProvider();
	const currentModelId = getActiveModelId();

	if (!currentProvider || !currentModelId) {
		throw new Error('No provider or model selected');
	}

	return currentProvider.languageModel(currentModelId);
};
const updateModelList = async (p) => {
	modelList.value = null;
	model.value = null;
	try {
		const res = await p.client.listModels();
		modelList.value = res.data;
		model.value = modelList.value[0] || { id: p.client.defaultModelId };
	} catch (err) {
		console.log(err);
		modelList.value = [{ id: p.client.defaultModelId }];
		model.value = modelList.value[0];
	}
};
watch(
	() => provider.value,
	(v) => {
		if (!v) return;
		updateModelList(v);
	},
	{ immediate: true }
);

// dropdown menu
const dropdownRegistry = ref(new Map());
const DropdownMenuGap = 4; // btn 和 menu 的间距

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

const openDropdown = (key, btnId = key + '-btn', menuId = key + '-menu') => {
	const btnEl = document.getElementById(btnId);
	const menuEl = document.getElementById(menuId);
	if (!btnEl || !menuEl) return;

	const rect = btnEl.getBoundingClientRect();

	// open
	const placeholder = document.createComment('dropdown');

	menuEl.parentNode.insertBefore(placeholder, menuEl);
	menuEl.style.display = 'block';
	menuEl.style.visibility = 'hidden';
	menuEl.style.position = 'fixed';

	const pageEl = document.getElementById('vue-chat-ai-template');
	pageEl.appendChild(menuEl);

	const { left, top } = getDropdownPosition({
		rect,
		menuWidth: menuEl.offsetWidth,
		menuHeight: menuEl.offsetHeight,
		viewportWidth: window.innerWidth,
		viewportHeight: window.innerHeight,
		gap: DropdownMenuGap
	});

	Object.assign(menuEl.style, {
		position: 'fixed',
		left: left + 'px',
		top: top + 'px',
		zIndex: 9999,
		display: 'block',
		visibility: 'visible'
	});
	console.log('添加dropdown', key);
	dropdownRegistry.value.set(key, { btnEl, menuEl, placeholder });
};

const closeDropdown = (key) => {
	console.log('closeDropdown', key);

	const item = dropdownRegistry.value.get(key);
	if (!item) return;

	const { menuEl, placeholder } = item;

	if (placeholder && placeholder.parentNode) {
		placeholder.parentNode.insertBefore(menuEl, placeholder);
		placeholder.remove();
	}

	Object.assign(menuEl.style, {
		position: 'fixed',
		display: 'none'
	});

	dropdownRegistry.value.delete(key);
};

const moveDropdown = (key) => {
	const item = dropdownRegistry.value.get(key);
	if (!item) return;

	const { btnEl, menuEl } = item;
	const rect = btnEl.getBoundingClientRect();
	const { left, top } = getDropdownPosition({
		rect,
		menuWidth: menuEl.offsetWidth,
		menuHeight: menuEl.offsetHeight,
		viewportWidth: window.innerWidth,
		viewportHeight: window.innerHeight,
		gap: DropdownMenuGap
	});

	Object.assign(menuEl.style, {
		position: 'fixed',
		left: left + 'px',
		top: top + 'px',
		zIndex: 9999
	});
};

const updateDropdownPosition = () => {
	dropdownRegistry.value.forEach((_, key) => {
		moveDropdown(key);
	});
};

const toggleDropdown = (key, e) => {
	e.stopPropagation(); // 阻止冒泡
	if (dropdownRegistry.value.has(key)) {
		closeDropdown(key);
	} else {
		closeAllDropdown();
		openDropdown(key);
	}
};

const closeAllDropdown = () => {
	dropdownRegistry.value.forEach((_, key) => {
		closeDropdown(key);
	});
};

// sidebar
const isShowSidebar = ref(false);
const showSidebar = () => {
	isShowSidebar.value = true;
};
const hideSidebar = () => {
	cancelEditingConversationTitle();
	closeAllDropdown();
	isShowSidebar.value = false;
};

// input state
const inputValue = ref('');
const editorRef = ref(null);
const chatContainerRef = ref(null);
const placeholder = ref('询问任何问题');
const isFocus = ref(false);
const disabled = ref(false);
let isComposing = false; // 中文输入法输入中
const hasContent = ref(false); // 是否有内容
const isMultiline = ref(false);
const chatState = ref({
	thinking: false,
	search: false
});

// conversation
const conversations = ref(new Map());
const conversationIds = ref([]);
const conversationId = ref(null);

// message
const messageMap = ref(new Map());
const conversationMessages = ref(new Map());
const messageList = computed(() => {
	const ids = conversationMessages.value.get(conversationId.value) || [];
	return ids.map((id) => messageMap.value.get(id));
});
const hasMessages = computed(() => {
	return messageList.value.length > 0;
});
const conversationUsage = computed(() => aggregateUsage(messageList.value));
const conversationUsageLabel = computed(() => formatUsageLabel(conversationUsage.value));

// stream
let chatStream = null;
const isStreaming = ref(false);

// scroll
let touchMoving = false;
let userScrolling = false;
const isAtTop = ref(true);
let isAtBottom = true;
const showScrollButton = ref(false);
const autoScroll = ref(true);
const bottomAnchorRef = ref(null);

// conversation
const sortedConversationIds = computed(() => {
	return [...conversationIds.value].sort((a, b) => {
		const ca = conversations.value.get(a);
		const cb = conversations.value.get(b);

		if (ca?.pinned && !cb?.pinned) return -1;
		if (!ca?.pinned && cb?.pinned) return 1;

		const ta = ca?.updated_time || ca?.created_time;
		const tb = cb?.updated_time || cb?.created_time;

		return tb - ta;
	});
});

const createConversation = () => {
	const id = UUID();
	const conv = {
		conversation_id: id,
		title: 'untitled',
		created_time: Date.now(),
		updated_time: null
	};

	conversations.value.set(id, conv);
	conversationIds.value.push(id);
	conversationMessages.value.set(id, []);

	showScrollButton.value = false;
	conversationId.value = id;

	return id;
};

const switchConversation = (id) => {
	if (!conversations.value.has(id)) return;

	showScrollButton.value = false;
	conversationId.value = id;
};

const retitleConversation = (id, title) => {
	if (!conversations.value.has(id)) return;

	conversations.value.set(id, { ...conversations.value.get(id), title });
};

const deleteConversation = (id) => {
	if (!conversations.value.has(id)) return;

	const messageIds = conversationMessages.value.get(id) || [];
	messageIds.forEach((messageId) => {
		messageMap.value.delete(messageId);
	});

	conversationMessages.value.delete(id);
	conversations.value.delete(id);
	conversationIds.value.splice(conversationIds.value.indexOf(id), 1);

	if (conversationId.value === id) {
		conversationId.value = conversationIds.value[0] || null;
	}
};

const togglePinConversation = (id) => {
	if (!conversations.value.has(id)) return;

	const conv = conversations.value.get(id);
	conv.pinned = !conv.pinned;
	conversations.value.set(id, conv);
};

const updateConversationTime = (id) => {
	if (!conversations.value.has(id)) return;

	const conv = conversations.value.get(id);

	conversations.value.set(id, {
		...conv,
		updated_time: Date.now()
	});
};

const getConversationRecordId = (conversation) =>
	conversation?.conversation_id || conversation?.id || null;

const importConversation = (json) => {
	const data = JSON.parse(json);

	if (data.type !== 'vue-chat-conversation') {
		throw new Error('invalid file');
	}

	const conv = data.conversation;
	const convId = getConversationRecordId(conv);
	if (!convId) {
		throw new Error('invalid conversation id');
	}

	const normalizedConversation = {
		...conv,
		conversation_id: convId
	};

	conversations.value.set(convId, normalizedConversation);

	if (!conversationIds.value.includes(convId)) {
		conversationIds.value.push(convId);
	}

	const ids = [];

	data.messages.forEach((msg) => {
		messageMap.value.set(msg.id, msg);

		ids.push(msg.id);
	});

	conversationMessages.value.set(convId, ids);
};

const getConversationDataById = (convId) => {
	const conv = conversations.value.get(convId);

	const msgIds = conversationMessages.value.get(convId) || [];

	const messages = msgIds.map((id) => messageMap.value.get(id));

	const data = {
		version: 1,
		type: 'vue-chat-conversation',
		conversation: conv,
		messages
	};

	return JSON.stringify(data, null, 2);
};

// 获取全部对话数据
const getAllConversationsData = () => {
	const result = [];

	conversationIds.value.forEach((id) => {
		const conv = conversations.value.get(id);

		const msgIds = conversationMessages.value.get(id) || [];

		const messages = msgIds.map((i) => messageMap.value.get(i));

		result.push({
			conversation: conv,
			messages
		});
	});

	return JSON.stringify(
		{
			version: 1,
			type: 'vue-chat-backup',
			data: result
		},
		null,
		2
	);
};

const downloadConversation = (convId) => {
	const json = getConversationDataById(convId);
	downloadJSON(`conversation_${convId}.json`, json);
};

const downloadBackUp = () => {
	const json = getAllConversationsData();
	downloadJSON('conversations_backup.json', json);
};

const restoreBackup = (json) => {
	const data = JSON.parse(json);

	if (data.type !== 'vue-chat-backup') {
		throw new Error('invalid backup');
	}

	data.data.forEach((item) => {
		const conv = item.conversation;
		const convId = getConversationRecordId(conv);
		if (!convId) return;

		const normalizedConversation = {
			...conv,
			conversation_id: convId
		};

		conversations.value.set(convId, normalizedConversation);

		if (!conversationIds.value.includes(convId)) {
			conversationIds.value.push(convId);
		}

		const ids = [];

		item.messages.forEach((msg) => {
			messageMap.value.set(msg.id, msg);

			ids.push(msg.id);
		});

		conversationMessages.value.set(convId, ids);
	});
};

// message functions
// helper functions for message
const isSafeToFlush = (text) => {
	let inCodeBlock = false;
	let fence = null;

	// --- 1. 处理 code block ---
	const fences = text.match(/(```|~~~)/g);

	if (fences) {
		for (let i = 0; i < fences.length; i++) {
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

	// --- 2. 强信号：段落结束 ---
	if (text.includes('\n\n')) return true;

	// --- 3. 判断是否在 list 中 ---
	const lines = text.split('\n');
	const lastLine = lines[lines.length - 1];
	const prevLine = lines[lines.length - 2] || '';

	const listPattern = /^(\s*)([-*+]|\d+\.)\s+/;

	const isPrevLineList = listPattern.test(prevLine);
	const isLastLineList = listPattern.test(lastLine);

	// 👉 情况1：刚输入完一个 list item，还没结束 list
	if (isPrevLineList && lastLine === '') {
		return false;
	}

	// 👉 情况2：正在连续 list
	if (isPrevLineList && isLastLineList) {
		return false;
	}

	// --- 4. 弱信号：普通换行 ---
	if (text.endsWith('\n')) {
		return true;
	}

	return false;
};

const updateMessageContent = (id, token) => {
	const msg = messageMap.value.get(id);
	if (!msg) return;

	msg.raw += token;
	msg.tail += token;
	// 判断是否安全渲染markdown
	if (isSafeToFlush(msg.tail)) {
		msg.rendered += md.render(msg.tail);
		msg.tail = '';
	}
};

const updateMessageThinking = (id, thinkingToken) => {
	const msg = messageMap.value.get(id);
	if (!msg) return;

	if (!msg.thinkingRaw) msg.thinkingRaw = '';
	msg.thinkingRaw += thinkingToken;
};

const updateMessageStatus = (id, status) => {
	const msg = messageMap.value.get(id);
	if (!msg) return;

	msg.status = status;
};

const updateMessageUsage = (id, usage) => {
	const msg = messageMap.value.get(id);
	if (!msg) return;

	msg.usage = mergeUsage(msg.usage, usage);
};

const updateMessageThinkingStatus = (id, thinking) => {
	const msg = messageMap.value.get(id);
	if (!msg) return;

	msg.thinking = thinking;
	if (thinking) msg.foldThinking = true;
};

const toggleFoldThinking = (id) => {
	const msg = messageMap.value.get(id);
	if (!msg) return;

	msg.foldThinking = !msg.foldThinking;
};

const endMessageRendering = (id) => {
	const msg = messageMap.value.get(id);
	if (!msg) return;

	if (msg.tail) {
		msg.rendered += md.render(msg.tail);
		msg.tail = '';
	}
};

const addMessage = (msg, index = null) => {
	messageMap.value.set(msg.id, msg);

	const convId = conversationId.value;
	const list = conversationMessages.value.get(convId) || [];

	const newList = [...list];

	if (index === null || index === undefined) {
		newList.push(msg.id);
	} else {
		newList.splice(index, 0, msg.id);
	}
	conversationMessages.value.set(convId, newList);
};

const deleteMessage = (id) => {
	const msg = messageMap.value.get(id);
	if (!msg) return;

	const convId = msg.conversation_id;
	const list = conversationMessages.value.get(convId);

	if (list) {
		const index = list.indexOf(id);
		if (index !== -1) {
			const newList = [...list];
			newList.splice(index, 1);

			conversationMessages.value.set(convId, newList);
		}
	}
	messageMap.value.delete(id);
};

// 从messageList中获取 可以给AI提供的messages 的方法
const system = 'You are a helpful assistant.';

const buildMessagesUntil = (messageId) => {
	const messages = [];

	if (system) messages.push({ role: 'system', content: system });

	for (const msg of messageList.value) {
		if (!msg) continue;

		messages.push({
			role: msg.role,
			content: msg.raw || msg.rendered || ''
			// name: msg.name,
		});

		if (msg.id === messageId) {
			break;
		}
	}

	return messages;
};

const AddUserMessage = (question) => {
	// user
	const userMessageId = UUID();

	const userMessage = {
		conversation_id: conversationId.value,
		id: userMessageId,
		role: 'user', // assistant | user
		provider: provider.value.name,
		model: getActiveModelId(),
		rendered: question,
		raw: question,
		status: 'sent',
		parent: null,
		children: [],
		created_time: Date.now(),
		updated_time: null
	};

	updateConversationTime(conversationId.value);

	addMessage(userMessage);

	return userMessageId;
};

const AddAssistantMessage = (userQuestionId, extraPayload = {}, index) => {
	// assistant
	const assistantMessageId = UUID();

	const assistantMessage = {
		conversation_id: conversationId.value,
		id: assistantMessageId,
		provider: provider.value.name,
		model: getActiveModelId(),
		role: 'assistant',
		rendered: '', // markdown渲染后的html
		raw: '', // 初始为空字符串, 原始token
		thinkingRaw: null,
		tail: '', // 正在流式的纯文本
		usage: createEmptyUsage(),
		status: 'streaming',
		parent: userQuestionId,
		children: [],
		created_time: Date.now(),
		updated_time: null,
		...extraPayload
	};

	updateConversationTime(conversationId.value);

	addMessage(assistantMessage, index);
	return assistantMessageId;
};

// send message
const getTitleByMsg = async (question, conversationId) => {
	let title = '';
	const titleStream = getActiveLanguageModel().streamText({
		prompt: `请根据后面的信息生成一个极简的、概括性的标题，用于保存这段聊天记录，不要回答其他的非标题文字: [ ${question} ]`,
		onText: (t) => {
			title += t;
		}
	});
	await titleStream.completion.catch(() => {});
	if (title.trim())
		conversations.value.set(conversationId, {
			...conversations.value.get(conversationId),
			title
		});
	else
		conversations.value.set(conversationId, {
			...conversations.value.get(conversationId),
			title: 'untitled'
		});
	return title;
};

const buildMessageStream = async () => {
	const question = inputValue.value;
	if (!question.trim()) return;
	if (!conversationId.value) createConversation();

	const userMessageId = AddUserMessage(question);

	clearInput();
	scrollToBottomSmooth();

	const messages = buildMessagesUntil();
	// 生成标题
	if (messages.filter((m) => m.role === 'user').length === 1) {
		getTitleByMsg(question, conversationId.value);
	}

	const assistantMessageId = AddAssistantMessage(userMessageId, { messages });

	// 发送消息的参数
	const params = {
		thinking: chatState.value.thinking
	};

	startStreaming(assistantMessageId, messages, params);
};

let scrollFrameId = null;
const scheduleAutoScroll = () => {
	if (userScrolling || !autoScroll.value || scrollFrameId !== null) return;

	scrollFrameId = requestAnimationFrame(async () => {
		scrollFrameId = null;
		await scrollToBottom();
	});
};

const startStreaming = async (assistantMessageId, msg, params) => {
	let reasoningActive = false;

	chatStream = getActiveLanguageModel().streamText({
		messages: msg,
		onStart: () => {
			console.log('stream onStart');
			isStreaming.value = true;
			updateMessageStatus(assistantMessageId, 'streaming');
		},
		onResponse: (r) => {
			console.log('streaming onResponse', r);
		},
		onReasoning: (t) => {
			if (!reasoningActive) {
				console.log('stream onThinkingStart');
				reasoningActive = true;
				updateMessageThinkingStatus(assistantMessageId, true);
			}
			updateMessageThinking(assistantMessageId, t);
		},
		onText: (t) => {
			if (reasoningActive) {
				console.log('stream onThinkingEnd');
				reasoningActive = false;
				updateMessageThinkingStatus(assistantMessageId, false);
			}
			updateMessageContent(assistantMessageId, t);
			scheduleAutoScroll();
		},
		onError: (err) => {
			console.log('stream onError', err);
			reasoningActive = false;
			isStreaming.value = false;
			updateMessageThinkingStatus(assistantMessageId, false);
			endMessageRendering(assistantMessageId);
			updateMessageStatus(assistantMessageId, 'error');
		},
		onAbort: () => {
			console.log('stream onAbort success');
			reasoningActive = false;
			isStreaming.value = false;
			updateMessageThinkingStatus(assistantMessageId, false);
			endMessageRendering(assistantMessageId);
			updateMessageStatus(assistantMessageId, 'aborted');
		},
		onFinish: (result) => {
			if (reasoningActive) {
				console.log('stream onThinkingEnd');
				reasoningActive = false;
				updateMessageThinkingStatus(assistantMessageId, false);
			}
			console.log('stream onFinish');
			updateMessageUsage(assistantMessageId, result?.usage);
			endMessageRendering(assistantMessageId);
			isStreaming.value = false;
			updateMessageStatus(assistantMessageId, 'sent');
			scheduleAutoScroll();
		},
		onFinally: () => {
			console.log('stream onFinally');
		},
		providerOptions: params
	});
	await chatStream.completion.catch(() => {});
};

const stopStreaming = () => {
	if (!chatStream) return;
	chatStream.abort();
};

const clearInput = () => {
	inputValue.value = '';
	editorRef.value.innerHTML = '';

	updateInputStatus();
};

// actions
// copy
const copyingId = ref(null);

const copyText = (id) => {
	const msg = messageMap.value.get(id);
	if (!msg) return;
	navigator.clipboard.writeText(msg.raw);

	copyingId.value = id;
	setTimeout(() => {
		copyingId.value = null;
	}, 2000);
};

const zanCai = (message, type) => {
	if (message.zanCai === type) {
		message.zanCai = null;
	} else {
		message.zanCai = type;
	}
};

const regenerateMessage = (message) => {
	const convId = message.conversation_id;
	const list = conversationMessages.value.get(convId) || [];
	const index = list.indexOf(message.id);

	deleteMessage(message.id);
	const messages = buildMessagesUntil(message.parent);
	const assistantMessageId = AddAssistantMessage(message.parent, { messages }, index);
	const params = {
		thinking: chatState.value.thinking
	};
	startStreaming(assistantMessageId, messages, params);
};

const editingConversationId = ref(null);
const newTitle = ref('');
const startEditingConversationTitle = (id) => {
	editingConversationId.value = id;
	newTitle.value = conversations.value.get(id)?.title;
};

const finishEditingConversationTitle = () => {
	retitleConversation(editingConversationId.value, newTitle.value);
	editingConversationId.value = null;
	newTitle.value = '';
};

const cancelEditingConversationTitle = () => {
	editingConversationId.value = null;
	newTitle.value = '';
};

// action list
const conversationActions = ref([
	{
		key: 'pin',
		name: (id) => {
			if (conversations.value.get(id)?.pinned) return '取消置顶对话';
			else if (!conversations.value.get(id)?.pinned) return '置顶对话';
			return '置顶/取消置顶对话';
		},
		icon: () => Pin,
		action: (id) => {
			togglePinConversation(id);
			closeAllDropdown();
		},
		disabledOnNavbar: (id) => !id
	},
	{
		key: 'retitle',
		name: () => '重命名对话',
		icon: () => Edit,
		action: (id) => {
			startEditingConversationTitle(id);
			closeAllDropdown();
		},
		disabledOnNavbar: () => true
	},
	{
		key: 'delete',
		name: () => '删除对话',
		icon: () => Delete,
		actionStyle: 'action-warning',
		action: (id) => {
			deleteConversation(id);
			closeAllDropdown();
		},
		disabledOnNavbar: (id) => !id
	},
	{
		key: 'export',
		name: () => '导出当前对话JSON',
		icon: () => Share,
		action: (id) => {
			downloadConversation(id);
			closeAllDropdown();
		},
		disabledOnNavbar: (id) => !id
	},
	{
		key: 'export_all',
		name: () => '导出全部对话JSON',
		icon: () => Share,
		action: () => {
			downloadBackUp();
			closeAllDropdown();
		},
		disabledOnSidebar: () => true,
		disabledOnNavbar: () => conversationIds.value.length === 0
	},
	{
		key: 'import',
		name: () => '导入对话JSON文件',
		icon: () => Share,
		action: () => importFile(importConversation),
		disabledOnSidebar: () => true
	},
	{
		key: 'restore',
		name: () => '恢复备份JSON文件',
		icon: () => Share,
		action: () => importFile(restoreBackup),
		disabledOnSidebar: () => true
	}
]);

const messageActions = ref([
	{
		key: 'copy',
		name: 'copy',
		icon: (message) => (copyingId.value === message.id ? Checkmark : Copy),
		action: (message) => copyText(message.id)
	},
	{
		key: 'edit',
		name: 'edit',
		icon: () => Edit,
		disabled: (message) => message.role === 'assistant'
	},
	{
		key: 'zan',
		name: 'zan',
		icon: (message) => (message.zanCai === 'zan' ? Zan_fill : Zan),
		action: (message) => zanCai(message, 'zan'),
		disabled: (message) => message.role === 'user' || message.zanCai === 'cai'
	},
	{
		key: 'cai',
		name: 'cai',
		icon: (message) => (message.zanCai === 'cai' ? Cai_fill : Cai),
		action: (message) => zanCai(message, 'cai'),
		disabled: (message) => message.role === 'user' || message.zanCai === 'zan'
	},
	{
		key: 'share',
		name: 'share',
		icon: () => Share,
		disabled: (message) => message.role === 'user'
	},
	{
		key: 'regenerate',
		name: 'regenerate',
		icon: () => Refresh,
		action: (message) => regenerateMessage(message),
		disabled: (message) => message.role === 'user'
	},
	{
		key: 'delete',
		name: 'delete',
		icon: () => Delete,
		action: (message) => deleteMessage(message.id),
		disabled: () => false
	}
]);

const composerActions = ref([
	{
		key: 'add_picture',
		name: '添加照片和文件',
		icon: () => FileSvg,
		action: () => console.log('添加照片和文件')
	},
	{
		key: 'add_line',
		name: '分割线',
		type: 'separator'
	},
	{
		key: 'thinking',
		name: '深度思考',
		icon: () => Think,
		action: () => console.log('深度思考'),
		key: 'thinking'
	},
	{
		key: 'search',
		name: '网络搜索',
		icon: () => Websearch,
		action: () => console.log('网络搜索'),
		key: 'search'
	},
	{
		key: 'create_picture',
		name: '创建图片',
		icon: () => Pic,
		action: () => console.log('创建图片'),
		disabled: () => true
	}
]);

// input status update
const updateMultilineStatus = () => {
	const editor = editorRef.value;
	if (!editor) return;

	const lineHeight = 24; // 和 CSS 保持一致
	const padding = 6; // 和 CSS 保持一致
	const height = lineHeight + padding * 2 + 10;
	if (editor.scrollHeight > height) {
		isMultiline.value = true;
	}
	if (!hasContent.value) {
		isMultiline.value = false;
	}
};

const updateHasContent = () => {
	hasContent.value = inputValue.value !== '';
	const el = editorRef.value;
	if (!el) return;
	el.dataset.empty = inputValue.value === '' ? 'true' : 'false';
};

const updateInputStatus = () => {
	updateMultilineStatus();
	updateHasContent();
};

// scroll
const restartAutoScroll = () => {
	userScrolling = false;
	autoScroll.value = true;
};

const scrollToBottom = async () => {
	await nextTick();
	const el = chatContainerRef.value;
	if (!el) return;

	el.scrollTop = el.scrollHeight; // 直接滚动
};

const scrollToBottomSmooth = async () => {
	await nextTick();
	const el = chatContainerRef.value;
	if (!el) return;

	el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
};

// 需改进 安全滚动到底部
let scrollLock = false;
const safeScrollToBottom = async () => {
	if (scrollLock) return;
	scrollLock = true;

	await scrollToBottom();

	requestAnimationFrame(() => {
		scrollLock = false;
	});
};

const checkIfAtBottom = (scrollTop, clientHeight, scrollHeight) => {
	return scrollTop + clientHeight >= scrollHeight - 80; // 允许100px内容可见
};

const handleContainerScroll = (e) => {
	const { scrollTop, clientHeight, scrollHeight } = e.target;

	isAtTop.value = scrollTop < 30; // 判断是否在顶部
	isAtBottom = checkIfAtBottom(scrollTop, clientHeight, scrollHeight); // 判断是否在底部
	showScrollButton.value = !isAtBottom;
};

// handler
const handleWindwoResize = (e) => {
	updateDropdownPosition();
};

const handleWheel = (e) => {
	userScrolling = true;
	autoScroll.value = false; // 用户滚动时则关闭自动滚动
};

const handleTouchStart = (e) => {
	if (e.touches.length > 1) return; // 多指操作
	touchMoving = true;
	userScrolling = true;
	autoScroll.value = false;
};

const handleTouchEnd = (e) => {
	touchMoving = false;
};

const handleTouchMove = (e) => {
	if (e.touches.length > 1) return; // 多指操作
};

const handleDocClick = (e) => {
	closeAllDropdown();
};

const handleKeydown = (e) => {
	if (disabled.value) return;
	if (e.isComposing || e.keyCode === 229 || e.which === 229) return; // 输入法期间不处理 Enter 229适配safari
	if (e.key === 'Enter' && !e.shiftKey) {
		e.preventDefault();
		if (!disabled.value && !isStreaming.value) buildMessageStream();
	}
};

const handleFocus = (e) => {
	isFocus.value = true;
};

const handleBlur = (e) => {
	isFocus.value = false;
};

const handleInput = (e) => {
	const el = editorRef.value;
	if (!el) return;

	const text = el.textContent?.replace(/\u200B/g, '') || '';
	// 同步值
	inputValue.value = text; // 或 textContent

	updateInputStatus();
};

const onCompositionStart = (e) => {
	isComposing = true;
};

const onCompositionEnd = (e) => {
	isComposing = false;
};

// 生命周期
let mediaQueryList;
let colorSchemeHandler;
onMounted(() => {
	window.addEventListener('resize', handleWindwoResize);
	document.addEventListener('click', handleDocClick);
	mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
	colorSchemeHandler = (e) => {
		console.log('prefers-color-scheme', e.matches);
		document.documentElement.classList.toggle('dark', e.matches);
	};
	mediaQueryList.addEventListener('change', colorSchemeHandler);
	document.documentElement.classList.toggle('dark', mediaQueryList.matches);
});
onBeforeUnmount(() => {
	window.removeEventListener('resize', handleWindwoResize);
	document.removeEventListener('click', handleDocClick);
	if (scrollFrameId !== null) {
		cancelAnimationFrame(scrollFrameId);
		scrollFrameId = null;
	}
	if (mediaQueryList && colorSchemeHandler) {
		mediaQueryList.removeEventListener('change', colorSchemeHandler);
	}
});
</script>

<template>
	<!-- container -->
	<div class="vue-chat-ai-template" id="vue-chat-ai-template">
		<!-- sidebar -->
		<div class="sidebar" :class="{ show: isShowSidebar }">
			<div class="sidebar-header">
				<button
					class="sidebar-header-left icon-btn hoverable"
					@click="(hideSidebar(), createConversation())"
				>
					<OllamaHello class="icon" />
				</button>
				<button class="sidebar-header-right icon-btn hoverable" @click="hideSidebar">
					<SidebarLeft class="icon" />
				</button>
			</div>
			<div class="sidebar-actions">
				<button class="sidebar-menu-item hoverable" @click="createConversation">
					<NewConversation />
					新聊天
				</button>
			</div>
			<div class="sidebar-body" @scroll="updateDropdownPosition">
				<div class="history-list">
					<a
						v-for="cid in sortedConversationIds"
						class="sidebar-menu-item hoverable"
						:class="{ current: conversationId === cid }"
						@click="switchConversation(cid)"
					>
						<div
							style="
								display: flex;
								flex-direction: column;
								align-items: start;
								z-index: 100;
							"
						>
							<div
								v-if="editingConversationId !== cid"
								@dblclick="startEditingConversationTitle(cid)"
							>
								{{ conversations.get(cid)?.title }}
							</div>
							<input
								v-else
								v-model="newTitle"
								autofocus="true"
								@blur="finishEditingConversationTitle"
								@keyup.enter="finishEditingConversationTitle"
								@keyup.esc="cancelEditingConversationTitle"
							/>

							<!-- <div>id:{{ cid }}</div>
							<div>
								created_time:{{ formatTime(conversations.get(cid)?.created_time) }}
							</div>
							<div>
								updated_time:{{ formatTime(conversations.get(cid)?.updated_time) }}
							</div> -->
						</div>

						<!-- 对话列表按钮 -->
						<div class="dropdown">
							<Pin_fill
								v-if="conversations.get(cid)?.pinned"
								class="hoverhidden"
								style="
									z-index: 999;
									position: absolute;
									right: 50%;
									top: 50%;
									transform: translate(50%, -50%) scale(1.5);
									color: gray;
								"
							/>

							<button
								:id="`conversation-sidebar-dropdown-${cid}-btn`"
								class="dropdown-btn icon-btn-small hoverable-icon icon"
								@click="
									toggleDropdown(`conversation-sidebar-dropdown-${cid}`, $event)
								"
							>
								<More />
							</button>

							<div
								:id="`conversation-sidebar-dropdown-${cid}-menu`"
								class="dropdown-menu"
							>
								<template
									v-if="conversationActions && conversationActions.length > 0"
								>
									<template v-for="ca in conversationActions" :key="ca">
										<template
											v-if="
												!(ca.disabledOnSidebar && ca.disabledOnSidebar(cid))
											"
										>
											<label
												v-if="!ca.disabled"
												class="menu-item hoverable"
												@click.stop="ca.action && ca.action(cid)"
												:class="ca.actionStyle"
											>
												<div class="menu-left">
													<component :is="ca.icon()" />
													<div class="menu-item-title">
														{{ ca.name(cid) }}
													</div>
												</div>
												<div class="checkmark">
													<Checkmark />
												</div>
											</label>
										</template>
									</template>
								</template>
							</div>
						</div>
					</a>
				</div>
			</div>
			<!-- <div class="sidebar-footer">你的账号</div> -->
		</div>
		<!-- 主界面 -->
		<div
			class="chat-container"
			ref="chatContainerRef"
			@scroll="handleContainerScroll"
			@wheel="handleWheel"
			@touchstart="handleTouchStart"
			@touchend="handleTouchEnd"
			@touchmove="handleTouchMove"
		>
			<!-- 顶部导航 -->
			<div class="chat-nav" :class="{ top: isAtTop }">
				<div class="chat-nav-left">
					<!-- 打开侧边栏 -->
					<button
						class="icon-btn hoverable page-back"
						@click="showSidebar"
						style="transform: rotate(0deg)"
					>
						<Sidebar class="icon" />
					</button>
					<!-- 切换提供商 -->
					<div class="dropdown">
						<button
							id="provider-dropdown-btn"
							class="model-switcher-btn dropdown-btn hoverable"
							@click="toggleDropdown('provider-dropdown', $event)"
						>
							<div class="dropdown-btn-text">
								{{ provider?.name || 'Select Provider' }}
							</div>
							<ChevronDown style="transform: translateY(3px)" />
						</button>
					</div>
					<!-- 切换模型 -->
					<div class="dropdown">
						<button
							id="model-dropdown-btn"
							class="model-switcher-btn dropdown-btn hoverable"
							@click="toggleDropdown('model-dropdown', $event)"
						>
							<div class="dropdown-btn-text">{{ model?.id || 'Select Model' }}</div>
							<ChevronDown style="transform: translateY(3px)" />
						</button>
					</div>
				</div>
				<div class="chat-nav-right">
					<div v-if="conversationUsageLabel" class="conversation-usage-pill">
						{{ conversationUsageLabel }}
					</div>
					<!-- 更多 -->
					<div class="dropdown dropdown-right">
						<button
							id="conversation-navbar-dropdown-btn"
							class="model-switcher-btn dropdown-btn hoverable"
							@click="toggleDropdown('conversation-navbar-dropdown', $event)"
						>
							<More />
						</button>
					</div>
				</div>
			</div>
			<!-- 对话 -->
			<div class="chat-msg-container">
				<!-- 中间标题 -->
				<div v-if="!hasMessages" class="page-title-container">{{ VUE_TITLE }}</div>

				<!-- 消息列表 -->
				<div
					class="chat-msg"
					v-for="message in messageList"
					:key="message.id"
					:class="{
						'chat-msg-assistant': message.role === 'assistant',
						'chat-msg-user': message.role === 'user'
					}"
				>
					<template v-if="message.thinkingRaw && message.thinkingRaw !== ''">
						<template v-if="message.thinking">thinking...</template>
						<div
							v-if="message.thinkingRaw"
							class="chat-msg-content chat-msg-thinking"
							@click="toggleFoldThinking(message.id)"
						>
							<span>&lt;Thinking&gt;</span>
							<span style="display: inline" v-if="message.foldThinking">...</span>
							<div
								v-else
								class="streaming-rendered prose"
								v-html="message.thinkingRaw"
							></div>
							<span>&lt;/Thinking&gt;</span>
						</div>
					</template>
					<template v-if="message.role === 'user'">
						<!-- 纯文本渲染 -->
						<div class="chat-msg-content">
							{{ message.raw }}
						</div>
					</template>
					<template v-else-if="message.role === 'assistant'">
						<!-- markdown 渲染 -->
						<div class="chat-msg-content">
							<div class="streaming-rendered prose" v-html="message.rendered"></div>
							<div class="streaming-tail" v-text="message.tail"></div>
						</div>
					</template>
					<template v-else>
						<!-- 纯文本渲染 -->
						<div class="chat-msg-content">
							{{ message.raw }}
						</div>
					</template>
					<!-- message下的操作按钮 -->
					<div
						v-if="message.role === 'assistant' && formatUsageLabel(message.usage)"
						class="message-usage"
					>
						<span>{{ formatUsageLabel(message.usage) }}</span>
						<span v-if="typeof message.usage?.inputTokens === 'number'">
							输入 {{ message.usage.inputTokens.toLocaleString('en-US') }}
						</span>
						<span v-if="typeof message.usage?.outputTokens === 'number'">
							输出 {{ message.usage.outputTokens.toLocaleString('en-US') }}
						</span>
					</div>
					<div class="action-wrapper">
						<div class="action-container">
							<template v-if="message.status === 'sent'">
								<template v-for="action in messageActions">
									<button
										v-if="!action.disabled || !action.disabled(message)"
										class="action-btn"
										:aria-label="action.name"
										@click="action.action && action.action(message)"
									>
										<component :is="action.icon(message)" />
									</button>
								</template>
							</template>
						</div>
					</div>
				</div>
			</div>
			<!-- 底部占位 -->
			<!-- <div ref="bottomAnchorRef" v-if="messages.length" class="bottom-anchor"></div> -->
			<!-- 输入框 -->
			<div class="chat-input-container">
				<div
					class="chat-input"
					:class="{ focus: isFocus, disabled, multiline: isMultiline }"
					@click.stop
				>
					<!-- 真实输入框 -->
					<div
						ref="editorRef"
						class="chat-input-editor grid-area-primary"
						data-empty="true"
						:contenteditable="!disabled"
						:placeholder
						@input="handleInput"
						@keydown="handleKeydown"
						@focus="handleFocus"
						@blur="handleBlur"
						@compositionstart="onCompositionStart"
						@compositionend="onCompositionEnd"
						:spellcheck="false"
						role="textbox"
					></div>

					<!-- Composer Actions -->
					<div id="composer-dropdown-btn" class="dropdown dropup-right grid-area-leading">
						<button
							class="icon-btn primary grid-area-leading dropdown-btn hoverable"
							@click="toggleDropdown('composer-dropdown', $event)"
							aria-label="send prompt"
							type="button"
						>
							<Plus class="icon" />
						</button>
					</div>

					<!-- 发送按钮 -->
					<button
						class="icon-btn hoverable secondary grid-area-trailing"
						type="button"
						aria-label="send prompt"
						@click="isStreaming ? stopStreaming() : buildMessageStream()"
					>
						<template v-if="isStreaming"><Stop class="icon" /></template>
						<template v-else><ArrowUp class="icon" /></template>
					</button>

					<!-- 隐藏的文本框 目前未使用 可以使用做兼容处理 -->
					<textarea
						class="hidden-textarea"
						id="hidden-textarea"
						disabled
						style="display: none"
					></textarea>
				</div>
				<!-- 滚动到底部按钮 -->
				<button
					class="scroll-bottom-btn"
					:style="{ opacity: showScrollButton ? '1' : '0' }"
					:disabled="!showScrollButton"
					@click="scrollToBottomSmooth"
				>
					<ArrowDown />
				</button>
			</div>
		</div>
		<!-- modal -->
		<div class="modal" v-if="isShowSidebar" @click.stop="hideSidebar"></div>
		<!-- dropdown -->
		<div id="provider-dropdown-menu" class="dropdown-menu">
			<template v-if="providerList && providerList.length > 0">
				<template v-for="pl in providerList" :key="pl">
					<label class="menu-item hoverable" @click.stop :class="pl.actionStyle">
						<input type="radio" name="provider" v-model="provider" :value="pl" />
						<div class="menu-left">
							<component :is="pl.icon()" class="icon-l" />
							<div>
								<div class="menu-item-title">{{ pl.name }}</div>
								<div class="menu-item-desc">{{ pl.desc }}</div>
							</div>
						</div>
						<div class="checkmark">
							<Checkmark />
						</div>
					</label>
				</template>
			</template>
		</div>
		<div id="model-dropdown-menu" class="dropdown-menu">
			<template v-if="modelList && modelList.length > 0">
				<template v-for="ml in modelList" :key="ml">
					<label class="menu-item hoverable" @click.stop :class="ml.actionStyle">
						<input type="radio" name="model" v-model="model" :value="ml" />
						<div class="menu-left">
							<component :is="Star" class="icon-l" />
							<div>
								<div class="menu-item-title">{{ ml.id }}</div>
							</div>
						</div>
						<div class="checkmark">
							<Checkmark />
						</div>
					</label>
				</template>
			</template>
		</div>
		<div id="conversation-navbar-dropdown-menu" class="dropdown-menu">
			<template v-if="conversationActions && conversationActions.length > 0">
				<template v-for="ca in conversationActions" :key="ca">
					<template v-if="!(ca.disabledOnNavbar && ca.disabledOnNavbar(conversationId))">
						<label
							v-if="!ca.disabled"
							class="menu-item hoverable"
							@click.stop="ca.action && ca.action(conversationId)"
							:class="ca.actionStyle"
						>
							<div class="menu-left">
								<component :is="ca.icon(conversationActions)" />
								<div class="menu-item-title">{{ ca.name(conversationId) }}</div>
							</div>
							<div class="checkmark">
								<Checkmark />
							</div>
						</label>
					</template>
				</template>
			</template>
		</div>
		<div id="composer-dropdown-menu" class="dropdown-menu">
			<template v-if="composerActions && composerActions.length > 0">
				<template v-for="ca in composerActions" :key="ca">
					<template v-if="ca.type && ca.type === 'separator'">
						<div class="menu-separator"></div>
					</template>
					<template v-else>
						<label
							class="menu-item hoverable"
							@click.stop="ca.action && ca.action($event)"
							v-if="!ca.disabled"
							:class="ca.actionStyle"
						>
							<template v-if="ca.key && ca.key !== ''">
								<input type="checkbox" name="ca.name" v-model="chatState[ca.key]" />
							</template>
							<div class="menu-left">
								<component v-if="ca.icon" :is="ca.icon()" />
								<div class="menu-item-title">{{ ca.name }}</div>
							</div>
							<div class="checkmark checkcolor">
								<Checkmark />
							</div>
						</label>
					</template>
				</template>
			</template>
		</div>
	</div>
</template>

<style scoped>
/* 重制默认样式 */
.vue-chat-ai-template button {
	outline: none;
	border: none;
	background-color: transparent;
	cursor: pointer;
}

.vue-chat-ai-template svg {
	pointer-events: none;
}

/* markdown渲染 */
.vue-chat-ai-template .prose :deep(*, ::after, ::before, ::backdrop) {
	box-sizing: border-box;
	border: 0 solid;
	margin: 0;
}
.vue-chat-ai-template .prose :deep(p) {
	margin-block: 4px;
}

.vue-chat-ai-template .prose :deep(hr) {
	height: 1px;
	background-color: var(--border-sharp);
	border: none;
}

.vue-chat-ai-template .prose :deep(blockquote) {
	border-left: 4px solid var(--border-sharp);
	padding-inline: 1rem;
}

.vue-chat-ai-template .prose :deep(pre) {
	overflow: scroll;
}
.vue-chat-ai-template .prose :deep(ul, ol, menu) {
	padding-inline: 1rem;
	margin-block: 1rem;
	height: fit-content;
	list-style: disc;
	list-style-position: inside;
	/* list-style: none; */
}

.vue-chat-ai-template .prose :deep(li) {
	margin-block: 4px;
	padding-block: 0;
	height: fit-content;
}

/* 主要 */
.vue-chat-ai-template * {
	box-sizing: border-box;
}

.vue-chat-ai-template {
	--white: #fff;
	--black: #000;
	--gray-0: #fff;
	--gray-25: #fcfcfc;
	--gray-50: #f9f9f9;
	--gray-75: #f2f2f2;
	--gray-100: #ececec;
	--gray-150: #e8e8e8;
	--gray-200: #e3e3e3;
	--gray-250: #d8d8d8;
	--gray-300: #cdcdcd;
	--gray-350: silver;
	--gray-400: #b4b4b4;
	--gray-450: #a8a8a8;
	--gray-500: #9b9b9b;
	--gray-550: #818181;
	--gray-600: #676767;
	--gray-650: #545454;
	--gray-700: #424242;
	--gray-750: #2f2f2f;
	--gray-800: #212121;
	--gray-850: #1c1c1c;
	--gray-900: #171717;
	--gray-925: #121212;
	--gray-950: #0d0d0d;
	--gray-975: #0c0c0c;
	--gray-1000: #0b0b0b;
}

.vue-chat-ai-template {
	-webkit-overflow-scrolling: touch;
	height: 100%;
	position: relative;
	overflow-y: auto;
	background-color: transparent;
	color-scheme: light dark;
	display: flex;
	flex-direction: row;

	--spacing: 0.25rem;
	--sidebar-width: 260px;
	--header-height: calc(var(--spacing) * 13);
	--menu-item-height: calc(var(--spacing) * 9);
	--text-xs: 0.75rem;
	--text-xs--line-height: calc(1/0.75);
	--text-sm: 0.875rem;
	--text-sm--line-height: calc(1.25/0.875);
	--text-base: 1rem;
	--text-base--line-height: calc(1.5/1);
	--text-lg: 1.125rem;
	--text-lg--line-height: calc(1.75/1.125);
	--text-xl: 1.25rem;
	--text-xl--line-height: calc(1.75/1.25);
	--text-2xl: 1.5rem;
	--text-2xl--line-height: calc(2/1.5);
	--text-3xl: 1.875rem;
	--text-3xl--line-height: calc(2.25/1.875);
	--text-4xl: 2.25rem;
	--text-4xl--line-height: calc(2.5/2.25);
	--text-5xl: 3rem;
	--text-5xl--line-height: 1;
	--text-6xl: 3.75rem;
	--text-6xl--line-height: 1;
	--text-7xl: 4.5rem;
	--text-7xl--line-height: 1;
	--radius-xs: 0.125rem;
	--radius-sm: 0.25rem;
	--radius-md: 0.375rem;
	--radius-lg: 0.5rem;
	--radius-xl: 0.75rem;
	--radius-2xl: 1rem;
	--radius-3xl: 1.5rem;
	--radius-4xl: 2rem;

	--bg-primary: #fff;
	--bg-primary-inverted: #000;
	--bg-secondary: #e8e8e8;
	--bg-tertiary: #f3f3f3;
	--bg-scrim: #0d0d0d80;

	--text-primary: #0d0d0d;
	--text-secondary: #5d5d5d;
	--text-tertiary: #8f8f8f;
	--text-inverted: #fff;

	--border-sharp: rgba(0, 0, 0, 0.1);
	--placeholder-color: rgba(153, 153, 153, 1);

	--input-bg: #fff;
	--input-shadow:
		rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px,
		rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px,
		rgba(0, 0, 0, 0.04) 0px 4px 4px 0px, rgba(0, 0, 0, 0.62) 0px 0px 1px 0px;

	--btn-bg-primary: #fff;
	--btn-bg-primary-hover: rgba(13, 13, 13, 0.05);
	--btn-bg-primary-active: rgba(13, 13, 13, 0.02);
	--btn-icon-primary: #000;

	--btn-bg-secondary: #000;
	--btn-bg-secondary-hover: #000;
	--btn-bg-secondary-active: rgba(0, 0, 0, 0.4);
	--btn-icon-secondary: #fff;

	--user-chat-width: 70%;

	--sidebar-surface-primary: #f9f9f9;
	--menu-item-highlighted: #0000000a;
	--menu-item-active: #0000000f;
	--menu-item-open: #00000006;

	--main-surface-background: #fffffff2;
	--message-surface: #e9e9e980;
	--composer-surface: var(--message-surface);
	--composer-blue-bg: #daeeff;
	--composer-blue-hover: #bddcf4;
	--composer-blue-hover-tint: #0084ff24;
	--composer-surface-primary: var(--main-surface-primary);
	--dot-color: var(--black);
	--text-primary: var(--gray-950);
	--icon-surface: 13 13 13;
	--text-primary-inverse: var(--gray-100);
	--content-primary: #01172b;
	--content-secondary: #44505b;
	--text-secondary: #0009;
	--text-tertiary: #0000004a;
	--text-quaternary: #00000030;
	--tag-blue: #08f;
	--tag-blue-light: #0af;
	--text-error: #f93a37;
	--text-danger: var(--red-500);
	--text-placeholder: #000000b3;
	--surface-error: 249 58 55;
	--border-xlight: #0000000d;
	--border-light: #0000001a;
	--border-medium: #00000026;
	--border-heavy: #0003;
	--border-xheavy: #00000040;
	--hint-text: #08f;
	--hint-bg: #b3dbff;
	--border-sharp: #0000000d;
	--icon-secondary: #676767;
	--main-surface-primary: var(--white);
	--main-surface-primary-inverse: var(--gray-800);
	--main-surface-secondary: var(--gray-50);
	--main-surface-secondary-selected: #0000001a;
	--main-surface-tertiary: var(--gray-100);
	--sidebar-surface-primary: var(--gray-50);
	--sidebar-surface-secondary: var(--gray-100);
	--sidebar-surface-tertiary: var(--gray-200);
	--sidebar-title-primary: #28282880;
	--sidebar-surface: #fcfcfc;
	--sidebar-body-primary: #0d0d0d;
	--sidebar-icon: #7d7d7d;
	--surface-hover: #00000012;
	--link: #2964aa;
	--link-hover: #749ac8;
	--selection: #007aff;
	--scrollbar-color: #0000001a;
	--scrollbar-color-hover: #0003;
}

/* 暗色模式 */
@media (prefers-color-scheme: dark) {
	.vue-chat-ai-template {
		--bg-primary: #212121;
		--bg-primary-inverted: #fff;
		--bg-secondary: #303030;
		--bg-tertiary: #414141;
		--bg-scrim: #0d0d0d80;

		--text-primary: #fff;
		--text-secondary: #f3f3f3;
		--text-tertiary: #afafaf;
		--text-inverted: #0d0d0d;

		--border-sharp: #ffffff0d;
		--placeholder-color: rgba(153, 153, 153, 1);

		--input-bg: #303030;
		--input-shadow:
			rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px,
			rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px,
			rgba(0, 0, 0, 0.1) 0px 4px 12px 0px, rgba(255, 255, 255, 0.2) 0px 0px 1px 0px inset;

		--btn-bg-primary: transparent;
		--btn-bg-primary-hover: rgba(255, 255, 255, 0.1);
		--btn-bg-primary-active: rgba(255, 255, 255, 0.05);
		--btn-icon-primary: #fff;

		--btn-bg-secondary: #fff;
		--btn-bg-secondary-hover: #fff;
		--btn-bg-secondary-active: #fff;
		--btn-icon-secondary: #000;

		--sidebar-surface-primary: #171717;
		--menu-item-highlighted: #ffffff1a;
		--menu-item-active: #ffffff0d;
		--menu-item-open: #ffffff0d;

		--main-surface-background: #212121e6;
		--message-surface: #323232d9;
		--composer-blue-bg: #2a4a6d;
		--composer-blue-hover: #1a416a;
		--composer-blue-text: #48aaff;
		--composer-surface-primary: #303030;
		--dot-color: var(--white);
		--text-primary: var(--gray-100);
		--icon-surface: 240 240 240;
		--text-primary-inverse: var(--gray-950);
		--text-secondary: #ffffffb3;
		--text-tertiary: #ffffff94;
		--text-quaternary: #ffffff69;
		--text-placeholder: #fffc;
		--content-primary: #f2f6fa;
		--content-secondary: #dbe2e8;
		--text-error: #f93a37;
		--border-xlight: #ffffff0d;
		--border-light: #ffffff1a;
		--border-medium: #ffffff26;
		--border-heavy: #fff3;
		--border-xheavy: #ffffff40;
		--border-sharp: #ffffff0d;

		--main-surface-primary: #393939;
		--main-surface-primary-inverse: var(--white);
		--main-surface-secondary: var(--gray-750);
		--main-surface-secondary-selected: #ffffff26;
		--main-surface-tertiary: var(--gray-700);
		--sidebar-surface-primary: var(--gray-900);
		--sidebar-surface-secondary: var(--gray-800);
		--sidebar-surface-tertiary: var(--gray-750);
		--sidebar-title-primary: #f0f0f080;
		--sidebar-surface: #2b2b2b;
		--sidebar-body-primary: #ededed;
		--sidebar-icon: #a4a4a4;
		--surface-hover: #ffffff26;
		--link: #7ab7ff;
		--link-hover: #5e83b3;
		--surface-error: 249 58 55;
		--scrollbar-color: #ffffff1a;
		--scrollbar-color-hover: #fff3;
	}
}

/* 通用按钮 */
.vue-chat-ai-template .hoverable:hover {
	background-color: var(--menu-item-highlighted);
}
.vue-chat-ai-template .hoverable:active {
	background-color: var(--menu-item-active);
}
.vue-chat-ai-template .hoverable-icon {
	color: transparent;
}
.vue-chat-ai-template .hoverable:hover .hoverable-icon {
	color: var(--text-tertiary);
}
.vue-chat-ai-template .hoverable:hover .hoverable-icon:hover {
	color: var(--text-primary);
}
.vue-chat-ai-template .hoverable:hover .hoverhidden {
	display: none;
}
.vue-chat-ai-template .action-warning * {
	color: var(--text-error);
}

.vue-chat-ai-template .icon-btn-small {
	border: none;
	background-color: transparent;
	cursor: pointer;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: calc(var(--spacing) * 5);
	height: calc(var(--spacing) * 5);
	border-radius: var(--radius-lg);
}
.vue-chat-ai-template .icon-btn {
	border: none;
	background-color: transparent;
	cursor: pointer;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: calc(var(--spacing) * 9);
	height: calc(var(--spacing) * 9);
	border-radius: var(--radius-lg);
}
.vue-chat-ai-template .icon-btn.primary {
	background-color: var(--btn-bg-primary);
	color: var(--btn-icon-primary);
	border: none;
	outline: none;
	border-radius: 50%;
	-webkit-tap-highlight-color: transparent;
}
.vue-chat-ai-template .icon-btn.primary:hover {
	background-color: var(--btn-bg-primary-hover);
}
.vue-chat-ai-template .icon-btn.primary:active {
	background-color: var(--btn-bg-primary-active);
}
.vue-chat-ai-template .icon-btn.secondary {
	background-color: var(--btn-bg-secondary);
	color: var(--btn-icon-secondary);
	border: none;
	outline: none;
	border-radius: 50%;
	-webkit-tap-highlight-color: transparent;
}
.vue-chat-ai-template .icon-btn.secondary:hover {
	background-color: var(--btn-bg-secondary-hover);
}
.vue-chat-ai-template .icon-btn.secondary:active {
	background-color: var(--btn-bg-secondary-active);
}

.vue-chat-ai-template .icon {
	border-radius: none;
	padding: 0 0 0 0;
	margin: none;
	width: calc(var(--spacing) * 5);
	height: calc(var(--spacing) * 5);
}

.vue-chat-ai-template .icon-l {
	border-radius: none;
	padding: 0 0 0 0;
	margin: none;
	width: calc(var(--spacing) * 6);
	height: calc(var(--spacing) * 6);
}

.vue-chat-ai-template .menu-separator {
	height: 1px;
	background-color: var(--border-sharp);
	margin-block: 0;
	margin-inline: calc(var(--spacing) * 4);
}

.vue-chat-ai-template .modal {
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background-color: rgba(0, 0, 0, 0.5);
	z-index: 99;
	display: none;
	justify-content: center;
	align-items: center;
}
/* sidebar */
.vue-chat-ai-template .sidebar {
	/* position: fixed; */
	position: relative;
	top: 0;
	left: calc(-1 * var(--sidebar-width));
	width: 0;
	opacity: 0;
	height: 100%;
	background-color: var(--sidebar-surface-primary);
	z-index: 100;
	display: flex;
	flex-direction: column;
	/* 需要一个弹簧动画 */
	transition:
		left 0.4s ease-in-out,
		width 0.4s ease-in-out,
		opacity 0.1s ease-in-out;
}
.vue-chat-ai-template .sidebar.show {
	display: flex;
	left: 0;
	opacity: 1;
	width: var(--sidebar-width);
}

.vue-chat-ai-template .sidebar-header {
	padding-inline: calc(var(--spacing) * 2);
	color: var(--text-primary);
	display: flex;
	flex-direction: row;
	justify-content: space-between;
	align-items: center;
	position: sticky;
	top: 0;
	width: 100%;
	height: var(--header-height);
	background-color: transparent;
}

.vue-chat-ai-template .sidebar-actions {
	padding: calc(var(--spacing) * 2);
	display: flex;
	flex-direction: column;
	gap: calc(var(--spacing) * 2);

	position: sticky;
	top: var(--header-height);
	background-color: transparent;
}

.vue-chat-ai-template .sidebar-body {
	flex: 1;
	overflow-y: auto;
	padding: calc(var(--spacing) * 2);
	background-color: transparent;
}

.vue-chat-ai-template .sidebar-footer {
	padding: calc(var(--spacing) * 2);
	border-top: 1px solid var(--border-sharp);
	text-align: right;
	background-color: transparent;
}

.vue-chat-ai-template .history-list {
	display: flex;
	flex-direction: column;
	gap: calc(var(--spacing) * 2);
	color: var(--text-primary);
}
.vue-chat-ai-template .history-list .current {
	background-color: var(--menu-item-active);
}

/* item */
.vue-chat-ai-template .sidebar-menu-item {
	border: none;
	background-color: transparent;
	outline: none;
	cursor: pointer;

	gap: calc(var(--spacing) * 1.5);
	width: 100%;
	max-width: calc(100% - 3 * var(--spacing));
	/* height: var(--menu-item-height); */

	margin-inline: calc(var(--spacing) * 1.5);
	padding-inline: calc(var(--spacing) * 2.5);
	padding-block: calc(var(--spacing) * 1.5);
	font-size: var(--text-sm);
	line-height: var(--text-sm--line-height);
	-webkit-user-select: none;
	user-select: none;
	border-radius: 10px;
	align-items: center;

	display: flex;
	position: relative;
}
.vue-chat-ai-template .history-list .sidebar-menu-item {
	justify-content: space-between;
	align-items: center;
}

.vue-chat-ai-template .sidebar-menu-item-icon {
	display: flex;
	align-items: center;
	justify-content: center;
}
.vue-chat-ai-template .sidebar-menu-item-text {
	display: flex;
	flex-grow: 1;
	align-items: center;
	gap: calc(var(--spacing) * 2.5);
}

/* 主界面 */
.vue-chat-ai-template .chat-container {
	-webkit-overflow-scrolling: touch;
	height: 100%;
	flex: 1;
	position: relative;
	overflow-y: auto;
	background-color: var(--bg-primary);
	color-scheme: light dark;
	display: flex;
	flex-direction: column;
}

/* 空白页面标题 */
.vue-chat-ai-template .page-title-container {
	color: var(--text-primary);
	font-size: 24px;
	position: absolute;
	width: 100%;
	height: 100%;
	top: 0;
	text-align: center;
	align-content: center;
}

/* 顶部导航 */
.vue-chat-ai-template .chat-nav {
	height: var(--header-height);
	width: 100%;
	position: sticky;
	top: 0;
	padding: calc(var(--spacing) * 2);
	/* background-color: pink; */
	display: flex;
	align-items: center;
	justify-content: flex-start;
	box-shadow: 0 1px 0 var(--border-sharp); /* 在最顶部没有shadow 到下方才出现shadow */
	backdrop-filter: blur(10px);
	z-index: 40;
}
.vue-chat-ai-template .chat-nav.top {
	box-shadow: 0 1px 0 transparent;
}

.vue-chat-ai-template .chat-nav-left {
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: center;
}
.vue-chat-ai-template .chat-nav-right {
	display: flex;
	flex-direction: row;
	align-items: center;
	gap: calc(var(--spacing) * 2);
	position: absolute;
	right: calc(var(--spacing) * 2);
	top: calc(var(--spacing) * 2);
}

.vue-chat-ai-template .conversation-usage-pill {
	display: inline-flex;
	align-items: center;
	height: calc(var(--spacing) * 8);
	padding-inline: calc(var(--spacing) * 3);
	border-radius: 999px;
	background-color: var(--main-surface-secondary);
	border: 1px solid var(--border-sharp);
	color: var(--text-secondary);
	font-size: var(--text-xs);
	line-height: 1;
	white-space: nowrap;
}

.vue-chat-ai-template .dropdown {
	position: relative;
	display: inline-block;
}

.vue-chat-ai-template .dropdown-menu {
	position: fixed;
	width: 260px;

	background: var(--main-surface-primary);
	border-radius: 1rem;
	box-shadow: 0 10px 20px rgba(0, 0, 0, 0.08);
	padding: 6px 6px;
	display: none;
	z-index: 10;
}

.vue-chat-ai-template .dropdown-btn {
	display: flex;
}
.vue-chat-ai-template .dropdown-btn-text {
	/* 超出部分省略 */
	overflow: hidden;
	text-overflow: ellipsis;
}

.vue-chat-ai-template .model-switcher-btn {
	/*   font-normal whitespace-nowrap focus-visible:outline-none */
	display: flex;
	cursor: pointer;
	align-items: center;
	justify-content: center;
	gap: calc(var(--spacing) * 1);
	border-radius: var(--radius-lg);
	min-height: calc(var(--spacing) * 9);
	padding-inline: calc(var(--spacing) * 2.5);
	padding-block: calc(var(--spacing) * 1.5);
	font-size: 18px;
	max-width: 140px;
	white-space: nowrap;
}

.vue-chat-ai-template .menu-item {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 10px 14px;
	cursor: pointer;
	border-radius: 10px;
}

.vue-chat-ai-template .menu-item input {
	/* 隐藏input */
	display: none;
}
.vue-chat-ai-template .menu-item .checkmark {
	opacity: 0;
}
.vue-chat-ai-template .menu-item input:checked ~ .checkmark {
	opacity: 1;
}

.vue-chat-ai-template .checkmark {
	color: var(--text-primary);
}

.vue-chat-ai-template .menu-left {
	display: flex;
	justify-content: center;
	align-items: center;
	gap: 10px;
	color: var(--content-primary);
}

.vue-chat-ai-template .menu-item-title {
	display: flex;
	align-items: center;
	gap: calc(var(--spacing) * 1);
	font-size: 14px;
}

.vue-chat-ai-template .menu-item-desc {
	margin-bottom: calc(var(--spacing) * 0.5);
	color: var(--text-tertiary);
	font-size: 12px;
}

/* 底部占位 */
.vue-chat-ai-template .bottom-anchor {
	content: '';
	height: 1px;
	width: 100%;
	background-color: red;
}

/* 对话 */
.vue-chat-ai-template .chat-msg-container {
	display: flex;
	flex-direction: column;
	height: auto;
	width: 100%;
	flex: 1;
	background-color: transparent;
	padding-bottom: calc(var(--spacing) * 25);
	color: var(--text-primary);
}
/* all msg */
.vue-chat-ai-template .chat-msg {
	background-color: transparent;
	padding-inline: calc(var(--spacing) * 4);
}
/* ai msg */
.vue-chat-ai-template .chat-msg-assistant {
	background-color: transparent;
}
.vue-chat-ai-template .chat-msg-assistant:last-child {
	padding-bottom: calc(var(--spacing) * 10);
	min-height: calc(100vh - var(--header-height) - var(--spacing) * 19 - var(--spacing) * 50);
}
.vue-chat-ai-template .chat-msg-assistant > .chat-msg-content {
	background-color: transparent;
}
.vue-chat-ai-template .chat-msg-assistant > .chat-msg-thinking {
	/* background-color: var(--bg-secondary); */
	padding-bottom: calc(var(--spacing) * 8);
	margin-bottom: calc(var(--spacing) * 4);
}
/* user msg */
.vue-chat-ai-template .chat-msg-user {
	background-color: transparent;
	gap: calc(var(--spacing) * 1);
	padding-top: calc(var(--spacing) * 3);
	display: flex;
	flex-direction: column;
	align-items: flex-end;
}
.vue-chat-ai-template .chat-msg-user > .chat-msg-content {
	padding-block: calc(var(--spacing) * 3); /* need to do multline 3 line 1.5 */
	padding-inline: calc(var(--spacing) * 4);
	border-radius: 18px;
	max-width: var(--user-chat-width, 70%);
	display: block;
	width: fit-content;
	/* 在屏幕右侧 */
	justify-self: start;
	align-self: flex-end;
	align-items: baseline;
	background-color: var(--message-surface);
}

.vue-chat-ai-template .chat-msg-content {
	white-space: pre-wrap;
	word-wrap: break-word;
	word-break: break-all;
	overflow-wrap: break-word;
	font-size: 16px;
	color: var(--text-primary);
	text-align: left;
}

.vue-chat-ai-template .message-usage {
	display: flex;
	flex-wrap: wrap;
	gap: calc(var(--spacing) * 2);
	margin-top: calc(var(--spacing) * 2);
	color: var(--text-tertiary);
	font-size: var(--text-xs);
	line-height: 1.4;
}

/* action */
.vue-chat-ai-template .action-wrapper {
	display: flex;
	justify-content: flex-end;
	position: relative;
	z-index: 0;
	background-color: transparent;
}

.vue-chat-ai-template .chat-msg-user .action-wrapper {
	justify-content: flex-end;
}
.vue-chat-ai-template .chat-msg-assistant .action-wrapper {
	justify-content: flex-start;
	transform: translateX(calc(var(--spacing) * -1.5));
}

.vue-chat-ai-template .action-container {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 0;
	padding-inline: 0;
	padding-block: 0;
	user-select: none;
	background-color: transparent;

	/* 初始状态隐藏 */
	opacity: 0;
	pointer-events: none;

	/* 过渡动画 */
	transition: opacity 0.3s ease;

	/* 兼容触摸设备 */
	touch-action: auto;
}

.vue-chat-ai-template .chat-msg:hover .action-container,
.vue-chat-ai-template .chat-msg:focus-within .action-container,
.vue-chat-ai-template .action-container[data-state='open'] {
	opacity: 1;
	pointer-events: auto;
}
/* 最后一项永远显示 */
.vue-chat-ai-template .chat-msg:last-child .action-container {
	opacity: 1;
	pointer-events: auto;
}

/* 按钮样式 */
.vue-chat-ai-template .action-btn {
	color: var(--text-secondary);
	background-color: transparent;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 0.25rem; /* 可根据需要调整 */
	cursor: pointer;
	transition: background-color 0.2s;
	border: none;
	width: 32px;
	height: 32px;
	border-radius: var(--radius-lg); /* rounded-lg */
}

.vue-chat-ai-template .action-btn:active {
	background-color: var(--bg-secondary);
}

.vue-chat-ai-template .action-btn:hover {
	background-color: var(--bg-secondary);
}

/* input-container */
.vue-chat-ai-template .chat-input-container {
	display: flex;
	padding-bottom: calc(var(--spacing) * 5);
	padding-inline: calc(var(--spacing) * 5);
	border: none;
	background: transparent;
	color: var(--text-primary);
	cursor: text;
	isolation: isolate;
	position: sticky;
	bottom: 0;
	z-index: 10;
}
.vue-chat-ai-template .chat-input-container::after {
	content: '';
	position: absolute;
	inset: 0;
	top: -50px;
	pointer-events: none;
	--fade-height: 128px;
	z-index: -1;
	background: linear-gradient(
		to bottom,
		transparent calc(100% - var(--fade-height)),
		var(--bg-primary) 100%
	);
}

/* toBottom */
.vue-chat-ai-template .scroll-bottom-btn {
	position: absolute;
	cursor: pointer;
	z-index: 1;
	background-clip: padding-box;
	border-radius: 50%;
	inset-inline-end: 50%;
	padding: 0;
	margin: 0;
	transform: translateX(50%);
	width: 32px;
	height: 32px;
	align-items: center;
	justify-content: center;
	bottom: calc(var(--spacing) * 6 + 24px + var(--spacing) * 8 + var(--spacing) * 5);
	border: 1px solid transparent;
	display: flex;
	transition: opacity 0.2s ease-in-out;
	backdrop-filter: blur(10px);
	background-color: transparent;
	color: var(--text-primary);
}

/* input */
.vue-chat-ai-template .chat-input {
	width: 100%;
	height: auto;
	background-color: var(--input-bg);
	box-shadow: var(--input-shadow);
	border: none;
	border-radius: 28px;
	padding: calc(var(--spacing) * 2.5);
	line-height: 24px; /* 中文高20px 英文18px  chatgpt 24px*/ /* line-height: 18px; */
	/* font-size: 16px; */
	/* background-color: blue; */
	display: grid;
	grid-template-areas: 'header header header' 'leading primary trailing' '. footer .';
	/* grid-template-areas: 'header header header' 'primary primary primary' 'leading footer trailing'; */
	grid-template-columns: auto 1fr auto;
	/* 换行 */
	grid-template-rows: auto auto auto;
	transition:
		grid-template-areas 0.2s ease,
		grid-template-rows 0.2s ease,
		padding 0.2s ease;
}

.vue-chat-ai-template .chat-input.multiline {
	grid-template-areas:
		'header header header'
		'primary primary primary'
		'leading footer trailing';
	grid-template-columns: auto 1fr auto;
	grid-template-rows: auto auto auto;
}

.vue-chat-ai-template .grid-area-header {
	grid-area: header;
}
.vue-chat-ai-template .grid-area-footer {
	grid-area: footer;
}
.vue-chat-ai-template .grid-area-trailing {
	grid-area: trailing;
}
.vue-chat-ai-template .grid-area-leading {
	grid-area: leading;
}
.vue-chat-ai-template .grid-area-primary {
	grid-area: primary;
}

.vue-chat-ai-template .chat-input .chat-input-editor {
	background-color: transparent;
	padding-block: calc(var(--spacing) * 1.5);
	padding-inline: calc(var(--spacing) * 2.5);
	min-height: calc(var(--spacing) * 6);
	max-height: calc(var(--spacing) * 40); /* 49 */
	/* scroll */
	overflow-y: auto;
	white-space: pre-wrap;
	word-wrap: break-word;
	word-break: break-all;
	overflow-wrap: break-word;
	min-width: 0;
	will-change: height;
}
/* .vue-chat-ai-template .chat-input.multiline .chat-input-editor {
} */

.vue-chat-ai-template .chat-input.disabled {
	opacity: 0.5;
}

/* placeholder  */
/* .chat-input .chat-input-editor:empty:before 也可使用 :empty */
.vue-chat-ai-template .chat-input .chat-input-editor[data-empty='true']:before {
	position: absolute;
	content: attr(placeholder);
	color: var(--placeholder-color);
	pointer-events: none;
}

.vue-chat-ai-template .chat-input .chat-input-editor:focus {
	/* remove browser default outline */
	outline: none;
}

.vue-chat-ai-template .chat-input .chat-input-bar {
	display: flex;
}

/* 640px 适配 */
@media (max-width: 768px) {
	.vue-chat-ai-template .sidebar {
		position: fixed;
	}
	.vue-chat-ai-template .modal {
		display: flex;
	}
}
</style>
