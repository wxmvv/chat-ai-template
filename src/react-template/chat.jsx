import React, { useEffect, useMemo, useRef, useState } from 'react';

import './chat.css';
import '../core/hljs-github.css';

import hljs from 'highlight.js/lib/common';
import markdownit from 'markdown-it';

import ArrowUp from '../icon/arrowUp.svg?raw';
import ArrowDown from '../icon/arrowDown.svg?raw';
import Plus from '../icon/plus.svg?raw';
import Stop from '../icon/stop.svg?raw';
import Copy from '../icon/copy.svg?raw';
import Checkmark from '../icon/checkmark.svg?raw';
import Refresh from '../icon/refresh.svg?raw';
import Delete from '../icon/delete.svg?raw';
import Edit from '../icon/edit.svg?raw';
import Share from '../icon/share.svg?raw';
import Zan from '../icon/zan.svg?raw';
import Cai from '../icon/cai.svg?raw';
import ZanFill from '../icon/zan_fill.svg?raw';
import CaiFill from '../icon/cai_fill.svg?raw';
import ChevronDown from '../icon/chevron_down.svg?raw';
import Star from '../icon/star.svg?raw';
import Gpt from '../icon/gpt.svg?raw';
import More from '../icon/more.svg?raw';
import Sidebar from '../icon/sidebar.svg?raw';
import NewConversation from '../icon/new_conversation.svg?raw';
import SidebarLeft from '../icon/sidebar_left.svg?raw';
import OllamaHello from '../icon/ollama.svg?raw';
import Websearch from '../icon/websearch.svg?raw';
import Pic from '../icon/pic.svg?raw';
import FileSvg from '../icon/file.svg?raw';
import Think from '../icon/think.svg?raw';
import Pin from '../icon/pin.svg?raw';
import PinFill from '../icon/pin_fill.svg?raw';

import { deepseek, ollama } from '../core/ai';
import {
	aggregateUsage,
	createEmptyUsage,
	formatUsageLabel,
	mergeUsage
} from '../core/ai/core/token-usage.js';
import { UUID, downloadJSON, importFile } from '../core/utils';
import {
	checkIfAtBottom,
	getConversationRecordId,
	getDropdownPosition,
	isSafeToFlush,
	sortConversationIds
} from './chat-helpers.js';

const VUE_TITLE = 'react-chat-ai-demo';
const DropdownMenuGap = 4;
const system = 'You are a helpful assistant.';

const md = markdownit({
	html: false,
	xhtmlOut: true,
	breaks: true,
	langPrefix: '',
	linkify: true,
	typographer: true,
	highlight(str, lang) {
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
		} catch (error) {
			console.warn('[highlight error]', error);
			return `<pre><code class="hljs plaintext">${md.utils.escapeHtml(str)}</code></pre>`;
		}
	}
}).enable('table');

const providerList = [
	{
		name: 'deepseek',
		client: deepseek(),
		icon: Gpt,
		desc: '深度求索！'
	},
	{
		name: 'ollama',
		client: ollama(),
		icon: Star,
		desc: '本地小羊驼🦙'
	}
];

function SvgIcon({ src, className, ...props }) {
	return (
		<span
			aria-hidden="true"
			className={['svg-icon', className].filter(Boolean).join(' ')}
			dangerouslySetInnerHTML={{ __html: src }}
			{...props}
		/>
	);
}

const cloneMessage = (message) => ({ ...message });

export default function Chat() {
	const [provider, setProvider] = useState(providerList[1]);
	const [modelList, setModelList] = useState(null);
	const [model, setModel] = useState(null);
	const [isShowSidebar, setIsShowSidebar] = useState(false);
	const [inputValue, setInputValue] = useState('');
	const [placeholder] = useState('询问任何问题');
	const [isFocus, setIsFocus] = useState(false);
	const [disabled] = useState(false);
	const [hasContent, setHasContent] = useState(false);
	const [isMultiline, setIsMultiline] = useState(false);
	const [chatState, setChatState] = useState({
		thinking: false,
		search: false
	});
	const [conversations, setConversations] = useState(() => new Map());
	const [conversationIds, setConversationIds] = useState([]);
	const [conversationId, setConversationId] = useState(null);
	const [messageMap, setMessageMap] = useState(() => new Map());
	const [conversationMessages, setConversationMessages] = useState(() => new Map());
	const [isStreaming, setIsStreaming] = useState(false);
	const [isAtTop, setIsAtTop] = useState(true);
	const [showScrollButton, setShowScrollButton] = useState(false);
	const [copyingId, setCopyingId] = useState(null);
	const [editingConversationId, setEditingConversationId] = useState(null);
	const [newTitle, setNewTitle] = useState('');
	const [openDropdownKey, setOpenDropdownKey] = useState(null);
	const [dropdownPositionState, setDropdownPositionState] = useState({
		key: null,
		left: 0,
		top: 0,
		visible: false
	});

	const chatContainerRef = useRef(null);
	const editorRef = useRef(null);
	const buttonRefs = useRef(new Map());
	const menuRefs = useRef(new Map());
	const scrollFrameIdRef = useRef(null);
	const chatStreamRef = useRef(null);
	const userScrollingRef = useRef(false);
	const autoScrollRef = useRef(true);
	const isAtBottomRef = useRef(true);
	const isComposingRef = useRef(false);
	const colorSchemeMediaQueryRef = useRef(null);
	const colorSchemeHandlerRef = useRef(null);
	const latestRef = useRef({});

	latestRef.current = {
		provider,
		model,
		chatState,
		conversations,
		conversationIds,
		conversationId,
		messageMap,
		conversationMessages,
		isStreaming
	};

	const messageList = useMemo(() => {
		const ids = conversationMessages.get(conversationId) || [];
		return ids.map((id) => messageMap.get(id)).filter(Boolean);
	}, [conversationId, conversationMessages, messageMap]);

	const hasMessages = messageList.length > 0;
	const conversationUsage = useMemo(() => aggregateUsage(messageList), [messageList]);
	const conversationUsageLabel = useMemo(
		() => formatUsageLabel(conversationUsage),
		[conversationUsage]
	);

	const sortedConversationIds = useMemo(
		() => sortConversationIds(conversationIds, conversations),
		[conversationIds, conversations]
	);

	useEffect(() => {
		let cancelled = false;

		const updateModelList = async () => {
			setModelList(null);
			setModel(null);

			try {
				const result = await provider.client.listModels();
				if (cancelled) return;

				const nextModelList = result.data;
				setModelList(nextModelList);
				setModel(nextModelList[0] || { id: provider.client.defaultModelId });
			} catch (error) {
				console.log(error);
				if (cancelled) return;

				const fallback = [{ id: provider.client.defaultModelId }];
				setModelList(fallback);
				setModel(fallback[0]);
			}
		};

		updateModelList();

		return () => {
			cancelled = true;
		};
	}, [provider]);

	useEffect(() => {
		const handleWindowResize = () => {
			updateDropdownPosition();
		};

		const handleDocumentClick = () => {
			closeAllDropdown();
		};

		window.addEventListener('resize', handleWindowResize);
		document.addEventListener('click', handleDocumentClick);

		colorSchemeMediaQueryRef.current = window.matchMedia('(prefers-color-scheme: dark)');
		colorSchemeHandlerRef.current = (event) => {
			document.documentElement.classList.toggle('dark', event.matches);
		};
		colorSchemeMediaQueryRef.current.addEventListener('change', colorSchemeHandlerRef.current);
		document.documentElement.classList.toggle('dark', colorSchemeMediaQueryRef.current.matches);

		return () => {
			window.removeEventListener('resize', handleWindowResize);
			document.removeEventListener('click', handleDocumentClick);

			if (scrollFrameIdRef.current !== null) {
				cancelAnimationFrame(scrollFrameIdRef.current);
				scrollFrameIdRef.current = null;
			}

			if (colorSchemeMediaQueryRef.current && colorSchemeHandlerRef.current) {
				colorSchemeMediaQueryRef.current.removeEventListener(
					'change',
					colorSchemeHandlerRef.current
				);
			}

			if (chatStreamRef.current) {
				chatStreamRef.current.abort();
			}
		};
	}, []);

	useEffect(() => {
		const el = editorRef.current;
		if (!el) return;

		el.dataset.empty = inputValue === '' ? 'true' : 'false';
		setHasContent(inputValue !== '');

		if (!inputValue) {
			setIsMultiline(false);
			return;
		}

		const lineHeight = 24;
		const padding = 6;
		const height = lineHeight + padding * 2 + 10;
		setIsMultiline(el.scrollHeight > height);
	}, [inputValue]);

	useEffect(() => {
		if (!openDropdownKey) {
			setDropdownPositionState((prev) => ({ ...prev, key: null, visible: false }));
			return;
		}

		const frameId = requestAnimationFrame(() => {
			updateDropdownPosition(openDropdownKey);
		});

		return () => cancelAnimationFrame(frameId);
	}, [openDropdownKey]);

	const getActiveProvider = () => latestRef.current.provider?.client || null;
	const getActiveModelId = () =>
		latestRef.current.model?.id || getActiveProvider()?.defaultModelId || null;

	const getActiveLanguageModel = () => {
		const activeProvider = getActiveProvider();
		const activeModelId = getActiveModelId();

		if (!activeProvider || !activeModelId) {
			throw new Error('No provider or model selected');
		}

		return activeProvider.languageModel(activeModelId);
	};

	const registerDropdownButton = (key) => (node) => {
		if (node) {
			buttonRefs.current.set(key, node);
		} else {
			buttonRefs.current.delete(key);
		}
	};

	const registerDropdownMenu = (key) => (node) => {
		if (node) {
			menuRefs.current.set(key, node);
		} else {
			menuRefs.current.delete(key);
		}
	};

	const updateDropdownPosition = (key = openDropdownKey) => {
		if (!key) return;

		const btnEl = buttonRefs.current.get(key);
		const menuEl = menuRefs.current.get(key);
		if (!btnEl || !menuEl) return;

		const rect = btnEl.getBoundingClientRect();
		const { left, top } = getDropdownPosition({
			rect,
			menuWidth: menuEl.offsetWidth,
			menuHeight: menuEl.offsetHeight,
			viewportWidth: window.innerWidth,
			viewportHeight: window.innerHeight,
			gap: DropdownMenuGap
		});

		setDropdownPositionState({
			key,
			left,
			top,
			visible: true
		});
	};

	const closeAllDropdown = () => {
		setOpenDropdownKey(null);
	};

	const toggleDropdown = (key, event) => {
		event.stopPropagation();
		setOpenDropdownKey((current) => (current === key ? null : key));
	};

	const showSidebar = () => {
		setIsShowSidebar(true);
	};

	const cancelEditingConversationTitle = () => {
		setEditingConversationId(null);
		setNewTitle('');
	};

	const hideSidebar = () => {
		cancelEditingConversationTitle();
		closeAllDropdown();
		setIsShowSidebar(false);
	};

	const createConversation = () => {
		const id = UUID();
		const conversation = {
			conversation_id: id,
			title: 'untitled',
			created_time: Date.now(),
			updated_time: null
		};

		setConversations((prev) => {
			const next = new Map(prev);
			next.set(id, conversation);
			return next;
		});
		setConversationIds((prev) => [...prev, id]);
		setConversationMessages((prev) => {
			const next = new Map(prev);
			next.set(id, []);
			return next;
		});
		setShowScrollButton(false);
		setConversationId(id);
		latestRef.current.conversationId = id;

		return id;
	};

	const switchConversation = (id) => {
		if (!latestRef.current.conversations.has(id)) return;
		setShowScrollButton(false);
		setConversationId(id);
	};

	const retitleConversation = (id, title) => {
		setConversations((prev) => {
			if (!prev.has(id)) return prev;
			const next = new Map(prev);
			next.set(id, {
				...prev.get(id),
				title
			});
			return next;
		});
	};

	const deleteConversation = (id) => {
		const messageIds = latestRef.current.conversationMessages.get(id) || [];

		setMessageMap((prev) => {
			const next = new Map(prev);
			for (const messageId of messageIds) {
				next.delete(messageId);
			}
			return next;
		});
		setConversationMessages((prev) => {
			const next = new Map(prev);
			next.delete(id);
			return next;
		});
		setConversations((prev) => {
			const next = new Map(prev);
			next.delete(id);
			return next;
		});
		setConversationIds((prev) => prev.filter((item) => item !== id));
		setConversationId((prev) => {
			if (prev !== id) return prev;
			return latestRef.current.conversationIds.filter((item) => item !== id)[0] || null;
		});
	};

	const togglePinConversation = (id) => {
		setConversations((prev) => {
			if (!prev.has(id)) return prev;
			const next = new Map(prev);
			const conversation = prev.get(id);
			next.set(id, {
				...conversation,
				pinned: !conversation?.pinned
			});
			return next;
		});
	};

	const updateConversationTime = (id) => {
		setConversations((prev) => {
			if (!prev.has(id)) return prev;
			const next = new Map(prev);
			const conversation = prev.get(id);
			next.set(id, {
				...conversation,
				updated_time: Date.now()
			});
			return next;
		});
	};

	const importConversation = (json) => {
		const data = JSON.parse(json);

		if (data.type !== 'vue-chat-conversation') {
			throw new Error('invalid file');
		}

		const conversation = data.conversation;
		const conversationRecordId = getConversationRecordId(conversation);
		if (!conversationRecordId) {
			throw new Error('invalid conversation id');
		}

		const normalizedConversation = {
			...conversation,
			conversation_id: conversationRecordId
		};

		setConversations((prev) => {
			const next = new Map(prev);
			next.set(conversationRecordId, normalizedConversation);
			return next;
		});
		setConversationIds((prev) =>
			prev.includes(conversationRecordId) ? prev : [...prev, conversationRecordId]
		);
		setMessageMap((prev) => {
			const next = new Map(prev);
			for (const message of data.messages) {
				next.set(message.id, message);
			}
			return next;
		});
		setConversationMessages((prev) => {
			const next = new Map(prev);
			next.set(
				conversationRecordId,
				data.messages.map((message) => message.id)
			);
			return next;
		});
	};

	const getConversationDataById = (convId) => {
		const conversation = latestRef.current.conversations.get(convId);
		const messageIds = latestRef.current.conversationMessages.get(convId) || [];
		const messages = messageIds
			.map((id) => latestRef.current.messageMap.get(id))
			.filter(Boolean);

		return JSON.stringify(
			{
				version: 1,
				type: 'vue-chat-conversation',
				conversation,
				messages
			},
			null,
			2
		);
	};

	const getAllConversationsData = () => {
		const data = latestRef.current.conversationIds.map((id) => {
			const conversation = latestRef.current.conversations.get(id);
			const messageIds = latestRef.current.conversationMessages.get(id) || [];
			const messages = messageIds
				.map((messageId) => latestRef.current.messageMap.get(messageId))
				.filter(Boolean);

			return {
				conversation,
				messages
			};
		});

		return JSON.stringify(
			{
				version: 1,
				type: 'vue-chat-backup',
				data
			},
			null,
			2
		);
	};

	const downloadConversation = (convId) => {
		downloadJSON(`conversation_${convId}.json`, getConversationDataById(convId));
	};

	const downloadBackUp = () => {
		downloadJSON('conversations_backup.json', getAllConversationsData());
	};

	const restoreBackup = (json) => {
		const data = JSON.parse(json);

		if (data.type !== 'vue-chat-backup') {
			throw new Error('invalid backup');
		}

		const nextConversations = new Map(latestRef.current.conversations);
		const nextMessageMap = new Map(latestRef.current.messageMap);
		const nextConversationMessages = new Map(latestRef.current.conversationMessages);
		const nextConversationIds = [...latestRef.current.conversationIds];

		for (const item of data.data) {
			const conversation = item.conversation;
			const conversationRecordId = getConversationRecordId(conversation);
			if (!conversationRecordId) continue;

			nextConversations.set(conversationRecordId, {
				...conversation,
				conversation_id: conversationRecordId
			});
			if (!nextConversationIds.includes(conversationRecordId)) {
				nextConversationIds.push(conversationRecordId);
			}

			const ids = [];
			for (const message of item.messages) {
				nextMessageMap.set(message.id, message);
				ids.push(message.id);
			}
			nextConversationMessages.set(conversationRecordId, ids);
		}

		setConversations(nextConversations);
		setConversationIds(nextConversationIds);
		setMessageMap(nextMessageMap);
		setConversationMessages(nextConversationMessages);
	};

	const updateMessage = (id, updater) => {
		setMessageMap((prev) => {
			const message = prev.get(id);
			if (!message) return prev;

			const next = new Map(prev);
			next.set(id, updater(cloneMessage(message)));
			return next;
		});
	};

	const updateMessageContent = (id, token) => {
		updateMessage(id, (message) => {
			message.raw += token;
			message.tail += token;

			if (isSafeToFlush(message.tail)) {
				message.rendered += md.render(message.tail);
				message.tail = '';
			}

			return message;
		});
	};

	const updateMessageThinking = (id, thinkingToken) => {
		updateMessage(id, (message) => {
			message.thinkingRaw = (message.thinkingRaw || '') + thinkingToken;
			return message;
		});
	};

	const updateMessageStatus = (id, status) => {
		updateMessage(id, (message) => {
			message.status = status;
			return message;
		});
	};

	const updateMessageUsage = (id, usage) => {
		updateMessage(id, (message) => {
			message.usage = mergeUsage(message.usage, usage);
			return message;
		});
	};

	const updateMessageThinkingStatus = (id, thinking) => {
		updateMessage(id, (message) => {
			message.thinking = thinking;
			if (thinking) message.foldThinking = true;
			return message;
		});
	};

	const toggleFoldThinking = (id) => {
		updateMessage(id, (message) => {
			message.foldThinking = !message.foldThinking;
			return message;
		});
	};

	const endMessageRendering = (id) => {
		updateMessage(id, (message) => {
			if (message.tail) {
				message.rendered += md.render(message.tail);
				message.tail = '';
			}
			return message;
		});
	};

	const addMessage = (message, index = null) => {
		setMessageMap((prev) => {
			const next = new Map(prev);
			next.set(message.id, message);
			return next;
		});
		setConversationMessages((prev) => {
			const next = new Map(prev);
			const list = next.get(message.conversation_id) || [];
			const newList = [...list];

			if (index === null || index === undefined) {
				newList.push(message.id);
			} else {
				newList.splice(index, 0, message.id);
			}

			next.set(message.conversation_id, newList);
			return next;
		});
	};

	const deleteMessage = (id) => {
		const message = latestRef.current.messageMap.get(id);
		if (!message) return;

		setConversationMessages((prev) => {
			const next = new Map(prev);
			const list = next.get(message.conversation_id) || [];
			next.set(
				message.conversation_id,
				list.filter((messageId) => messageId !== id)
			);
			return next;
		});
		setMessageMap((prev) => {
			const next = new Map(prev);
			next.delete(id);
			return next;
		});
	};

	const buildMessagesUntil = (messageId) => {
		const messages = [];
		const { conversationId: currentConversationId, conversationMessages: messageIdsMap } =
			latestRef.current;
		const ids = messageIdsMap.get(currentConversationId) || [];

		if (system) {
			messages.push({
				role: 'system',
				content: system
			});
		}

		for (const id of ids) {
			const message = latestRef.current.messageMap.get(id);
			if (!message) continue;

			messages.push({
				role: message.role,
				content: message.raw || message.rendered || ''
			});

			if (messageId && message.id === messageId) {
				break;
			}
		}

		return messages;
	};

	const addUserMessage = (question, currentConversationId = latestRef.current.conversationId) => {
		const userMessageId = UUID();
		const userMessage = {
			conversation_id: currentConversationId,
			id: userMessageId,
			role: 'user',
			provider: latestRef.current.provider.name,
			model: getActiveModelId(),
			rendered: question,
			raw: question,
			status: 'sent',
			parent: null,
			children: [],
			created_time: Date.now(),
			updated_time: null
		};

		updateConversationTime(currentConversationId);
		addMessage(userMessage);

		return userMessageId;
	};

	const addAssistantMessage = (
		userQuestionId,
		extraPayload = {},
		index,
		currentConversationId = latestRef.current.conversationId
	) => {
		const assistantMessageId = UUID();
		const assistantMessage = {
			conversation_id: currentConversationId,
			id: assistantMessageId,
			provider: latestRef.current.provider.name,
			model: getActiveModelId(),
			role: 'assistant',
			rendered: '',
			raw: '',
			thinkingRaw: null,
			tail: '',
			usage: createEmptyUsage(),
			status: 'streaming',
			parent: userQuestionId,
			children: [],
			created_time: Date.now(),
			updated_time: null,
			...extraPayload
		};

		updateConversationTime(currentConversationId);
		addMessage(assistantMessage, index);

		return assistantMessageId;
	};

	const scrollToBottom = async () => {
		const element = chatContainerRef.current;
		if (!element) return;
		element.scrollTop = element.scrollHeight;
	};

	const scrollToBottomSmooth = async () => {
		const element = chatContainerRef.current;
		if (!element) return;
		element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
	};

	const scheduleAutoScroll = () => {
		if (
			userScrollingRef.current ||
			!autoScrollRef.current ||
			scrollFrameIdRef.current !== null
		) {
			return;
		}

		scrollFrameIdRef.current = requestAnimationFrame(async () => {
			scrollFrameIdRef.current = null;
			await scrollToBottom();
		});
	};

	const clearInput = () => {
		setInputValue('');
		if (editorRef.current) {
			editorRef.current.innerHTML = '';
			editorRef.current.dataset.empty = 'true';
		}
	};

	const getTitleByMsg = async (question, currentConversationId) => {
		let title = '';
		const titleStream = getActiveLanguageModel().streamText({
			prompt: `请根据后面的信息生成一个极简的、概括性的标题，用于保存这段聊天记录，不要回答其他的非标题文字: [ ${question} ]`,
			onText: (text) => {
				title += text;
			}
		});

		await titleStream.completion.catch(() => {});

		setConversations((prev) => {
			if (!prev.has(currentConversationId)) return prev;
			const next = new Map(prev);
			next.set(currentConversationId, {
				...prev.get(currentConversationId),
				title: title.trim() || 'untitled'
			});
			return next;
		});

		return title;
	};

	const startStreaming = async (assistantMessageId, messages, params) => {
		let reasoningActive = false;

		chatStreamRef.current = getActiveLanguageModel().streamText({
			messages,
			onStart: () => {
				setIsStreaming(true);
				updateMessageStatus(assistantMessageId, 'streaming');
			},
			onResponse: (response) => {
				console.log('streaming onResponse', response);
			},
			onReasoning: (text) => {
				if (!reasoningActive) {
					reasoningActive = true;
					updateMessageThinkingStatus(assistantMessageId, true);
				}
				updateMessageThinking(assistantMessageId, text);
			},
			onText: (text) => {
				if (reasoningActive) {
					reasoningActive = false;
					updateMessageThinkingStatus(assistantMessageId, false);
				}
				updateMessageContent(assistantMessageId, text);
				scheduleAutoScroll();
			},
			onError: (error) => {
				console.log('stream onError', error);
				reasoningActive = false;
				setIsStreaming(false);
				updateMessageThinkingStatus(assistantMessageId, false);
				endMessageRendering(assistantMessageId);
				updateMessageStatus(assistantMessageId, 'error');
			},
			onAbort: () => {
				reasoningActive = false;
				setIsStreaming(false);
				updateMessageThinkingStatus(assistantMessageId, false);
				endMessageRendering(assistantMessageId);
				updateMessageStatus(assistantMessageId, 'aborted');
			},
			onFinish: (result) => {
				if (reasoningActive) {
					reasoningActive = false;
					updateMessageThinkingStatus(assistantMessageId, false);
				}
				updateMessageUsage(assistantMessageId, result?.usage);
				endMessageRendering(assistantMessageId);
				setIsStreaming(false);
				updateMessageStatus(assistantMessageId, 'sent');
				scheduleAutoScroll();
			},
			onFinally: () => {
				console.log('stream onFinally');
			},
			providerOptions: params
		});

		await chatStreamRef.current.completion.catch(() => {});
	};

	const buildMessageStream = async () => {
		const question = editorRef.current?.textContent?.replace(/\u200B/g, '') || inputValue;
		if (!question.trim()) return;

		let currentConversationId = latestRef.current.conversationId;
		if (!currentConversationId) {
			currentConversationId = createConversation();
		}

		const userMessageId = addUserMessage(question, currentConversationId);

		clearInput();
		scrollToBottomSmooth();

		const messages = [...buildMessagesUntil(), { role: 'user', content: question }];
		if (messages.filter((message) => message.role === 'user').length === 1) {
			getTitleByMsg(question, currentConversationId);
		}

		const assistantMessageId = addAssistantMessage(
			userMessageId,
			{ messages },
			undefined,
			currentConversationId
		);
		const params = {
			thinking: latestRef.current.chatState.thinking
		};

		startStreaming(assistantMessageId, messages, params);
	};

	const stopStreaming = () => {
		if (!chatStreamRef.current) return;
		chatStreamRef.current.abort();
	};

	const copyText = (id) => {
		const message = latestRef.current.messageMap.get(id);
		if (!message) return;

		navigator.clipboard.writeText(message.raw);
		setCopyingId(id);
		setTimeout(() => {
			setCopyingId(null);
		}, 2000);
	};

	const zanCai = (message, type) => {
		updateMessage(message.id, (nextMessage) => {
			nextMessage.zanCai = nextMessage.zanCai === type ? null : type;
			return nextMessage;
		});
	};

	const regenerateMessage = (message) => {
		const list = latestRef.current.conversationMessages.get(message.conversation_id) || [];
		const index = list.indexOf(message.id);

		deleteMessage(message.id);
		const messages = buildMessagesUntil(message.parent);
		const assistantMessageId = addAssistantMessage(message.parent, { messages }, index);
		startStreaming(assistantMessageId, messages, {
			thinking: latestRef.current.chatState.thinking
		});
	};

	const startEditingConversationTitle = (id) => {
		setEditingConversationId(id);
		setNewTitle(latestRef.current.conversations.get(id)?.title || '');
	};

	const finishEditingConversationTitle = () => {
		if (!editingConversationId) return;
		retitleConversation(editingConversationId, newTitle);
		cancelEditingConversationTitle();
	};

	const restartAutoScroll = () => {
		userScrollingRef.current = false;
		autoScrollRef.current = true;
	};

	const handleContainerScroll = (event) => {
		const { scrollTop, clientHeight, scrollHeight } = event.target;

		setIsAtTop(scrollTop < 30);
		isAtBottomRef.current = checkIfAtBottom(scrollTop, clientHeight, scrollHeight);
		setShowScrollButton(!isAtBottomRef.current);

		if (isAtBottomRef.current) {
			restartAutoScroll();
		}
	};

	const handleWheel = () => {
		userScrollingRef.current = true;
		autoScrollRef.current = false;
	};

	const handleTouchStart = (event) => {
		if (event.touches.length > 1) return;
		userScrollingRef.current = true;
		autoScrollRef.current = false;
	};

	const handleKeydown = (event) => {
		if (disabled) return;
		if (event.isComposing || event.keyCode === 229 || event.which === 229) return;

		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			if (!disabled && !latestRef.current.isStreaming) {
				buildMessageStream();
			}
		}
	};

	const handleInput = () => {
		const element = editorRef.current;
		if (!element) return;

		const text = element.textContent?.replace(/\u200B/g, '') || '';
		setInputValue(text);
	};

	const conversationActions = [
		{
			key: 'pin',
			name: (id) =>
				latestRef.current.conversations.get(id)?.pinned ? '取消置顶对话' : '置顶对话',
			icon: Pin,
			action: (id) => {
				togglePinConversation(id);
				closeAllDropdown();
			},
			disabledOnNavbar: (id) => !id
		},
		{
			key: 'retitle',
			name: () => '重命名对话',
			icon: Edit,
			action: (id) => {
				startEditingConversationTitle(id);
				closeAllDropdown();
			},
			disabledOnNavbar: () => true
		},
		{
			key: 'delete',
			name: () => '删除对话',
			icon: Delete,
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
			icon: Share,
			action: (id) => {
				downloadConversation(id);
				closeAllDropdown();
			},
			disabledOnNavbar: (id) => !id
		},
		{
			key: 'export_all',
			name: () => '导出全部对话JSON',
			icon: Share,
			action: () => {
				downloadBackUp();
				closeAllDropdown();
			},
			disabledOnSidebar: () => true,
			disabledOnNavbar: () => latestRef.current.conversationIds.length === 0
		},
		{
			key: 'import',
			name: () => '导入对话JSON文件',
			icon: Share,
			action: () => importFile(importConversation),
			disabledOnSidebar: () => true
		},
		{
			key: 'restore',
			name: () => '恢复备份JSON文件',
			icon: Share,
			action: () => importFile(restoreBackup),
			disabledOnSidebar: () => true
		}
	];

	const messageActions = [
		{
			key: 'copy',
			name: 'copy',
			icon: (message) => (copyingId === message.id ? Checkmark : Copy),
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
			icon: (message) => (message.zanCai === 'zan' ? ZanFill : Zan),
			action: (message) => zanCai(message, 'zan'),
			disabled: (message) => message.role === 'user' || message.zanCai === 'cai'
		},
		{
			key: 'cai',
			name: 'cai',
			icon: (message) => (message.zanCai === 'cai' ? CaiFill : Cai),
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
	];

	const composerActions = [
		{
			key: 'add_picture',
			name: '添加照片和文件',
			icon: FileSvg,
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
			icon: Think
		},
		{
			key: 'search',
			name: '网络搜索',
			icon: Websearch
		},
		{
			key: 'create_picture',
			name: '创建图片',
			icon: Pic,
			disabled: () => true
		}
	];

	const dropdownStyle = (key) => {
		const isOpen = openDropdownKey === key;
		const isPositioned = dropdownPositionState.key === key;

		return {
			display: isOpen ? 'block' : 'none',
			visibility:
				isOpen && isPositioned && dropdownPositionState.visible ? 'visible' : 'hidden',
			left: isPositioned ? `${dropdownPositionState.left}px` : '0px',
			top: isPositioned ? `${dropdownPositionState.top}px` : '0px'
		};
	};

	return (
		<div className="react-chat-ai-template" id="react-chat-ai-template">
			<div className={`sidebar ${isShowSidebar ? 'show' : ''}`}>
				<div className="sidebar-header">
					<button
						className="sidebar-header-left icon-btn hoverable"
						onClick={() => {
							hideSidebar();
							createConversation();
						}}
					>
						<SvgIcon src={OllamaHello} className="icon" />
					</button>
					<button
						className="sidebar-header-right icon-btn hoverable"
						onClick={hideSidebar}
					>
						<SvgIcon src={SidebarLeft} className="icon" />
					</button>
				</div>

				<div className="sidebar-actions">
					<button className="sidebar-menu-item hoverable" onClick={createConversation}>
						<SvgIcon src={NewConversation} />
						新聊天
					</button>
				</div>

				<div className="sidebar-body" onScroll={() => updateDropdownPosition()}>
					<div className="history-list">
						{sortedConversationIds.map((cid) => {
							const conversation = conversations.get(cid);
							const dropdownKey = `conversation-sidebar-dropdown-${cid}`;

							return (
								<div
									key={cid}
									className={`sidebar-menu-item hoverable ${
										conversationId === cid ? 'current' : ''
									}`}
									onClick={() => switchConversation(cid)}
								>
									<div
										style={{
											display: 'flex',
											flexDirection: 'column',
											alignItems: 'start',
											zIndex: 100
										}}
									>
										{editingConversationId !== cid ? (
											<div
												onDoubleClick={() =>
													startEditingConversationTitle(cid)
												}
											>
												{conversation?.title}
											</div>
										) : (
											<input
												autoFocus
												value={newTitle}
												onBlur={finishEditingConversationTitle}
												onChange={(event) =>
													setNewTitle(event.target.value)
												}
												onKeyDown={(event) => {
													if (event.key === 'Enter') {
														finishEditingConversationTitle();
													}
													if (event.key === 'Escape') {
														cancelEditingConversationTitle();
													}
												}}
											/>
										)}
									</div>

									<div className="dropdown">
										{conversation?.pinned ? (
											<SvgIcon
												src={PinFill}
												className="hoverhidden"
												style={{
													zIndex: 999,
													position: 'absolute',
													right: '50%',
													top: '50%',
													transform: 'translate(50%, -50%) scale(1.5)',
													color: 'gray'
												}}
											/>
										) : null}

										<button
											ref={registerDropdownButton(dropdownKey)}
											className="dropdown-btn icon-btn-small hoverable-icon icon"
											onClick={(event) => toggleDropdown(dropdownKey, event)}
										>
											<SvgIcon src={More} />
										</button>

										<div
											ref={registerDropdownMenu(dropdownKey)}
											className="dropdown-menu"
											style={dropdownStyle(dropdownKey)}
											onClick={(event) => event.stopPropagation()}
										>
											{conversationActions.map((action) =>
												action.disabledOnSidebar?.(cid) ? null : (
													<label
														key={action.key}
														className={`menu-item hoverable ${action.actionStyle || ''}`}
														onClick={(event) => {
															event.stopPropagation();
															action.action?.(cid);
														}}
													>
														<div className="menu-left">
															<SvgIcon src={action.icon} />
															<div className="menu-item-title">
																{action.name(cid)}
															</div>
														</div>
														<div className="checkmark">
															<SvgIcon src={Checkmark} />
														</div>
													</label>
												)
											)}
										</div>
									</div>
								</div>
							);
						})}
					</div>
				</div>
			</div>

			<div
				ref={chatContainerRef}
				className="chat-container"
				onScroll={handleContainerScroll}
				onWheel={handleWheel}
				onTouchEnd={() => {}}
				onTouchMove={() => {}}
				onTouchStart={handleTouchStart}
			>
				<div className={`chat-nav ${isAtTop ? 'top' : ''}`}>
					<div className="chat-nav-left">
						<button
							className="icon-btn hoverable page-back"
							onClick={showSidebar}
							style={{ transform: 'rotate(0deg)' }}
						>
							<SvgIcon src={Sidebar} className="icon" />
						</button>

						<div className="dropdown">
							<button
								ref={registerDropdownButton('provider-dropdown')}
								className="model-switcher-btn dropdown-btn hoverable"
								id="provider-dropdown-btn"
								onClick={(event) => toggleDropdown('provider-dropdown', event)}
							>
								<div className="dropdown-btn-text">
									{provider?.name || 'Select Provider'}
								</div>
								<SvgIcon
									src={ChevronDown}
									style={{ transform: 'translateY(3px)' }}
								/>
							</button>
						</div>

						<div className="dropdown">
							<button
								ref={registerDropdownButton('model-dropdown')}
								className="model-switcher-btn dropdown-btn hoverable"
								id="model-dropdown-btn"
								onClick={(event) => toggleDropdown('model-dropdown', event)}
							>
								<div className="dropdown-btn-text">
									{model?.id || 'Select Model'}
								</div>
								<SvgIcon
									src={ChevronDown}
									style={{ transform: 'translateY(3px)' }}
								/>
							</button>
						</div>
					</div>

					<div className="chat-nav-right">
						{conversationUsageLabel ? (
							<div className="conversation-usage-pill">{conversationUsageLabel}</div>
						) : null}

						<div className="dropdown dropdown-right">
							<button
								ref={registerDropdownButton('conversation-navbar-dropdown')}
								className="model-switcher-btn dropdown-btn hoverable"
								id="conversation-navbar-dropdown-btn"
								onClick={(event) =>
									toggleDropdown('conversation-navbar-dropdown', event)
								}
							>
								<SvgIcon src={More} />
							</button>
						</div>
					</div>
				</div>

				<div className="chat-msg-container">
					{!hasMessages ? <div className="page-title-container">{VUE_TITLE}</div> : null}

					{messageList.map((message) => (
						<div
							key={message.id}
							className={`chat-msg ${
								message.role === 'assistant'
									? 'chat-msg-assistant'
									: 'chat-msg-user'
							}`}
						>
							{message.thinkingRaw ? (
								<>
									{message.thinking ? <div>thinking...</div> : null}
									<div
										className="chat-msg-content chat-msg-thinking"
										onClick={() => toggleFoldThinking(message.id)}
									>
										<span>{'<Thinking>'}</span>
										{message.foldThinking ? (
											<span style={{ display: 'inline' }}>...</span>
										) : (
											<div
												className="streaming-rendered prose"
												dangerouslySetInnerHTML={{
													__html: message.thinkingRaw
												}}
											/>
										)}
										<span>{'</Thinking>'}</span>
									</div>
								</>
							) : null}

							{message.role === 'assistant' ? (
								<div className="chat-msg-content">
									<div
										className="streaming-rendered prose"
										dangerouslySetInnerHTML={{ __html: message.rendered }}
									/>
									<div className="streaming-tail">{message.tail}</div>
								</div>
							) : (
								<div className="chat-msg-content">{message.raw}</div>
							)}

							{message.role === 'assistant' && formatUsageLabel(message.usage) ? (
								<div className="message-usage">
									<span>{formatUsageLabel(message.usage)}</span>
									{typeof message.usage?.inputTokens === 'number' ? (
										<span>
											输入 {message.usage.inputTokens.toLocaleString('en-US')}
										</span>
									) : null}
									{typeof message.usage?.outputTokens === 'number' ? (
										<span>
											输出{' '}
											{message.usage.outputTokens.toLocaleString('en-US')}
										</span>
									) : null}
								</div>
							) : null}

							<div className="action-wrapper">
								<div className="action-container">
									{message.status === 'sent'
										? messageActions.map((action) =>
												action.disabled?.(message) ? null : (
													<button
														key={action.key}
														aria-label={action.name}
														className="action-btn"
														onClick={() => action.action?.(message)}
													>
														<SvgIcon src={action.icon(message)} />
													</button>
												)
											)
										: null}
								</div>
							</div>
						</div>
					))}
				</div>

				<div className="chat-input-container">
					<div
						className={`chat-input ${isFocus ? 'focus' : ''} ${
							disabled ? 'disabled' : ''
						} ${isMultiline ? 'multiline' : ''}`}
						onClick={(event) => event.stopPropagation()}
					>
						<div
							ref={editorRef}
							className="chat-input-editor grid-area-primary"
							contentEditable={!disabled}
							data-empty="true"
							placeholder={placeholder}
							role="textbox"
							spellCheck={false}
							onBlur={() => setIsFocus(false)}
							onCompositionEnd={() => {
								isComposingRef.current = false;
							}}
							onCompositionStart={() => {
								isComposingRef.current = true;
							}}
							onFocus={() => setIsFocus(true)}
							onInput={handleInput}
							onKeyDown={handleKeydown}
							suppressContentEditableWarning
						/>

						<div
							className="dropdown dropup-right grid-area-leading"
							id="composer-dropdown-btn"
						>
							<button
								ref={registerDropdownButton('composer-dropdown')}
								aria-label="send prompt"
								className="icon-btn primary grid-area-leading dropdown-btn hoverable"
								type="button"
								onClick={(event) => toggleDropdown('composer-dropdown', event)}
							>
								<SvgIcon src={Plus} className="icon" />
							</button>
						</div>

						<button
							aria-label="send prompt"
							className="icon-btn hoverable secondary grid-area-trailing"
							type="button"
							onClick={() => (isStreaming ? stopStreaming() : buildMessageStream())}
						>
							<SvgIcon src={isStreaming ? Stop : ArrowUp} className="icon" />
						</button>

						<textarea
							className="hidden-textarea"
							disabled
							id="hidden-textarea"
							style={{ display: 'none' }}
						/>
					</div>

					<button
						className="scroll-bottom-btn"
						disabled={!showScrollButton}
						style={{ opacity: showScrollButton ? '1' : '0' }}
						onClick={scrollToBottomSmooth}
					>
						<SvgIcon src={ArrowDown} />
					</button>
				</div>
			</div>

			{isShowSidebar ? <div className="modal" onClick={hideSidebar} /> : null}

			<div
				ref={registerDropdownMenu('provider-dropdown')}
				className="dropdown-menu"
				id="provider-dropdown-menu"
				style={dropdownStyle('provider-dropdown')}
				onClick={(event) => event.stopPropagation()}
			>
				{providerList.map((item) => (
					<label
						key={item.name}
						className="menu-item hoverable"
						onClick={(event) => {
							event.stopPropagation();
							setProvider(item);
							closeAllDropdown();
						}}
					>
						<input readOnly checked={provider.name === item.name} type="radio" />
						<div className="menu-left">
							<SvgIcon src={item.icon} className="icon-l" />
							<div>
								<div className="menu-item-title">{item.name}</div>
								<div className="menu-item-desc">{item.desc}</div>
							</div>
						</div>
						<div className="checkmark">
							<SvgIcon src={Checkmark} />
						</div>
					</label>
				))}
			</div>

			<div
				ref={registerDropdownMenu('model-dropdown')}
				className="dropdown-menu"
				id="model-dropdown-menu"
				style={dropdownStyle('model-dropdown')}
				onClick={(event) => event.stopPropagation()}
			>
				{(modelList || []).map((item) => (
					<label
						key={item.id}
						className="menu-item hoverable"
						onClick={(event) => {
							event.stopPropagation();
							setModel(item);
							closeAllDropdown();
						}}
					>
						<input readOnly checked={model?.id === item.id} type="radio" />
						<div className="menu-left">
							<SvgIcon src={Star} className="icon-l" />
							<div>
								<div className="menu-item-title">{item.id}</div>
							</div>
						</div>
						<div className="checkmark">
							<SvgIcon src={Checkmark} />
						</div>
					</label>
				))}
			</div>

			<div
				ref={registerDropdownMenu('conversation-navbar-dropdown')}
				className="dropdown-menu"
				id="conversation-navbar-dropdown-menu"
				style={dropdownStyle('conversation-navbar-dropdown')}
				onClick={(event) => event.stopPropagation()}
			>
				{conversationActions.map((action) =>
					action.disabledOnNavbar?.(conversationId) ? null : (
						<label
							key={action.key}
							className="menu-item hoverable"
							onClick={(event) => {
								event.stopPropagation();
								action.action?.(conversationId);
							}}
						>
							<div className="menu-left">
								<SvgIcon src={action.icon} />
								<div className="menu-item-title">{action.name(conversationId)}</div>
							</div>
							<div className="checkmark">
								<SvgIcon src={Checkmark} />
							</div>
						</label>
					)
				)}
			</div>

			<div
				ref={registerDropdownMenu('composer-dropdown')}
				className="dropdown-menu"
				id="composer-dropdown-menu"
				style={dropdownStyle('composer-dropdown')}
				onClick={(event) => event.stopPropagation()}
			>
				{composerActions.map((action) => {
					if (action.type === 'separator') {
						return <div key={action.key} className="menu-separator" />;
					}

					const disabledAction = action.disabled?.();
					return disabledAction ? null : (
						<label
							key={action.key}
							className="menu-item hoverable"
							onClick={(event) => {
								event.stopPropagation();
								if (action.key === 'thinking' || action.key === 'search') {
									setChatState((prev) => ({
										...prev,
										[action.key]: !prev[action.key]
									}));
								}
							}}
						>
							{action.key ? (
								<input
									readOnly
									checked={Boolean(chatState[action.key])}
									type="checkbox"
								/>
							) : null}
							<div className="menu-left">
								{action.icon ? <SvgIcon src={action.icon} /> : null}
								<div className="menu-item-title">{action.name}</div>
							</div>
							<div className="checkmark checkcolor">
								<SvgIcon src={Checkmark} />
							</div>
						</label>
					);
				})}
			</div>
		</div>
	);
}
