<script setup>
import { ref, computed, watch } from 'vue';
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

// import hljs from 'highlight.js';
import markdownit from 'markdown-it';
const md = markdownit({
	// WARNING: html: true allows HTML tags, which poses XSS security risks
	// Consider setting html: false or adding HTML sanitization (e.g., DOMPurify) in production
	html: false,
	xhtmlOut: true,
	breaks: true,
	langPrefix: 'language-',
	linkify: true, // Enable automatic link detection
	typographer: true, // Enable typographic replacements
	quotes: '“”‘’'
}).enable('table');

// emit
const emit = defineEmits(['focus', 'blur']);

// provider model
import deepseek from '../core/deepseek';
import ollama from '../core/ollama';
import { UUID } from '../core/utils';

const pageTitle = ref('vue-chat-ai-demo');
const showBack = ref(true);
const goBack = () => {
	document.querySelector('#vue-app').style.display = 'none';
	document.querySelector('#app').style.display = 'flex';
};

const providerList = [
	{
		name: 'ollama',
		api: ollama
	},
	{
		name: 'deepseek',
		api: deepseek
	}
];
const provider = ref(providerList[0]);
const modelList = ref();
const model = ref();
watch(
	() => provider.value,
	(v) => {
		if (!v) return;
		v.api
			.getModelList()
			.then((list) => {
				modelList.value = list.data;
				model.value = modelList.value[0] || null;
			})
			.catch((err) => {
				console.log(err);
				modelList.value = null;
				model.value = null;
			});
	},
	{ immediate: true }
);

// input state
const inputValue = ref('');
const editorRef = ref(null);
const chatContainerRef = ref(null);
const placeholder = ref('询问任何问题');
const isFocus = ref(false);
const disabled = ref(false);
const isComposing = ref(false); // 中文输入法输入中
const hasContent = ref(false); // 是否有内容
const isMultiline = ref(false);

// message
const messages = ref([]);
const hasMessages = computed(() => messages.value.length > 0);

// stream
const chatStreamRef = ref();
const isStreaming = ref(false);

// helper functions for message
const isSafeToFlush = (text) => {
	// 双换行说明段落结束
	if (text.includes('\n\n')) return true;

	// 代码块闭合
	const codeFenceMatches = text.match(/```/g);
	if (codeFenceMatches && codeFenceMatches.length % 2 === 0) {
		return true;
	}

	// 列表闭合
	const listMatches = text.match(/(\*|-|\+|\d+\.)\s*$/g);
	if (listMatches && listMatches.length % 2 === 0) {
		return true;
	}

	return false;
};

// 更新消息内容
const updateMessageContent = (messageId, token) => {
	const msg = messages.value.find((m) => m.id === messageId);
	if (!msg) return;
	msg.raw += token;
	msg.tail += token;

	// 判断是否安全渲染markdown
	if (isSafeToFlush(msg.tail)) {
		msg.rendered += md.render(msg.tail);
		msg.tail = '';
	}
};

// 更新消息状态
const updateMessageStatus = (messageId, status) => {
	const msg = messages.value.find((m) => m.id === messageId);
	if (!msg) return;
	msg.status = status;
};

// 结束消息渲染
const endMessageRendering = (messageId) => {
	const msg = messages.value.find((m) => m.id === messageId);
	if (msg && msg.tail) {
		msg.rendered += md.render(msg.tail);
		msg.tail = '';
	}
};

// send message
const sendMessage = async (question = inputValue.value) => {
	console.log('sendMessage', question);
	if (!question.trim()) return;
	messages.value.push({
		id: UUID(),
		type: 'user', // ai | user
		rendered: question,
		raw: question,
		timestamp: Date.now(),
		status: 'sent'
	});
	clear();

	// 提前生成AI消息ID
	const aiMessageId = UUID();

	const params = {
		model: model.value.id
	};

	// 创建AI消息（初始内容为空）
	messages.value.push({
		id: aiMessageId,
		type: 'ai',
		rendered: '', // markdown渲染后的html
		raw: '', // 初始为空字符串, 原始token
		tail: '', // 正在流式的纯文本
		timestamp: Date.now(),
		status: 'streaming'
	});

	chatStreamRef.value = provider.value.api.createChatStream({
		onStart: () => {
			isStreaming.value = true;
			updateMessageStatus(aiMessageId, 'streaming');
		},
		onResponse: (r) => {
			console.log('streaming', r);
		},
		onToken: (t) => {
			updateMessageContent(aiMessageId, t);
			scorllToBottom();
		},
		onError: (err) => {
			console.log(err);
			updateMessageStatus(aiMessageId, 'error');
		},
		onAbort: () => {
			console.log('abort success');
			updateMessageStatus(aiMessageId, 'aborted');
		},
		onEnd: () => {
			endMessageRendering(aiMessageId);
			isStreaming.value = false;
			updateMessageStatus(aiMessageId, 'sent');
			scorllToBottom();
		},
		...params
	});
	await chatStreamRef.value.start(question);
};

// 中断
const stopStreaming = () => {
	chatStreamRef.value.abort();
};

// 清空输入框
const clear = () => {
	inputValue.value = '';
	editorRef.value.innerHTML = '';
	hasContent.value = false;
	updateMultilineStatus();
};

// actions
// copy
const copyingId = ref(null);
const copyText = (text, id) => {
	navigator.clipboard.writeText(text);
	copyingId.value = id;
	setTimeout(() => {
		copyingId.value = null;
	}, 2000);
};

// zan cai
const zanCai = (message, type) => {
	console.log('zanCai', message, type);
	if (message.zanCai === type) {
		message.zanCai = null;
	} else {
		message.zanCai = type;
	}
};

// action list
const actions = ref([
	{
		name: 'copy',
		icon: (message) => (copyingId.value === message.id ? Checkmark : Copy),
		action: (message) => copyText(message.raw, message.id)
	},
	{
		name: 'edit',
		icon: () => Edit,
		disabled: (message) => message.type === 'ai'
	},
	{
		name: 'zan',
		icon: (message) => (message.zanCai === 'zan' ? Zan_fill : Zan),
		action: (message) => zanCai(message, 'zan'),
		disabled: (message) => message.type === 'user' || message.zanCai === 'cai'
	},
	{
		name: 'cai',
		icon: (message) => (message.zanCai === 'cai' ? Cai_fill : Cai),
		action: (message) => zanCai(message, 'cai'),
		disabled: (message) => message.type === 'user' || message.zanCai === 'zan'
	},
	{
		name: 'share',
		icon: () => Share,
		disabled: (message) => message.type === 'user'
	},
	{
		name: 'regenerate',
		icon: () => Refresh,
		disabled: (message) => message.type === 'user'
	},
	{
		name: 'delete',
		icon: () => Delete,
		disabled: () => true
	}
]);

// 多行状态
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

// 滚动到底部
const scorllToBottom = () => {
	// const el = document.querySelector('.chat-container');
	const el = chatContainerRef.value;
	if (!el) return;
	// el.scrollTop = el.scrollHeight; // 直接滚动
	el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); // 平滑滚动
};

// handler
const handleScroll = (e) => {
	if (e.target.scrollTop + e.target.clientHeight > e.target.scrollHeight - 100)
		document.querySelector('.scroll-bottom-btn').style.opacity = 0;
	else document.querySelector('.scroll-bottom-btn').style.opacity = 1;
};

const handleKeydown = (event) => {
	if (disabled.value) return;
	if (isComposing.value) return; // 输入法期间不处理 Enter
	console.log('handleKeydown', event);
	if (event.key === 'Enter' && !event.shiftKey) {
		event.preventDefault();
		if (!disabled.value && !isStreaming.value) sendMessage();
	}
};

const handleFocus = (event) => {
	isFocus.value = true;
	console.log('handleFocus', event);
	emit('focus');
};

const handleBlur = (event) => {
	isFocus.value = false;
	console.log('handleBlur', event);
	emit('blur');
};

const handleInput = (event) => {
	console.log('handleInput', event);
	const el = editorRef.value;
	if (!el) return;

	const text = el.textContent?.replace(/\u200B/g, '') || '';
	// 同步值
	inputValue.value = text; // 或 textContent
	hasContent.value = text !== '';
	el.dataset.empty = text === '' ? 'true' : 'false';
	updateMultilineStatus();
};

const onCompositionStart = (event) => {
	console.log('onCompositionStart', event);
	// 中文输入法 拼音开始
	isComposing.value = true;
};

const onCompositionEnd = (event) => {
	console.log('onCompositionEnd', event);
	// 中文输入法 拼音结束
	isComposing.value = false;
};
</script>

<template>
	<!-- 输入框 -->
	<div class="chat-container" ref="chatContainerRef" @scroll="handleScroll">
		<div class="chat-msg-container">
			<!-- 返回选择模版页 -->
			<div v-if="!hasMessages" class="page-title">{{ pageTitle }}</div>

			<!-- 切换模型与提供商的按钮 -->
			<button v-if="showBack" class="icon-btn page-back" @click="goBack">
				<ArrowUp />
			</button>
			<div class="ai-info">
				<select class="ai-info-item" v-model="provider">
					<option v-for="p in providerList" :key="p" :value="p">
						{{ p.name }}
					</option>
				</select>
				<template v-if="modelList">
					<select class="ai-info-item" v-model="model">
						<option v-for="m in modelList" :key="m" :value="m">
							{{ m.id || '未选择' }}
						</option>
					</select>
				</template>
				<template v-else>
					<div class="ai-info-item">无法获取模型列表</div>
				</template>
			</div>

			<!-- 消息列表 -->
			<div
				class="chat-msg"
				v-for="message in messages"
				:class="{
					'chat-msg-ai': message.type === 'ai',
					'chat-msg-user': message.type === 'user'
				}"
			>
				<template v-if="message.type === 'user'">
					<!-- 纯文本渲染 -->
					<div class="chat-msg-content">
						{{ message.raw }}
					</div>
				</template>
				<template v-else-if="message.type === 'ai'">
					<!-- markdown 渲染 -->
					<div class="chat-msg-content">
						<div
							class="streaming-rendered markdown-style"
							v-html="message.rendered"
						></div>
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
				<div class="action-wrapper">
					<div class="action-container">
						<template v-if="message.status === 'sent'">
							<template v-for="action in actions">
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
				></div>

				<!-- 更多按钮 -->
				<button
					class="icon-btn primary grid-area-leading"
					type="button"
					aria-label="send prompt"
				>
					<Plus />
				</button>

				<!-- 发送按钮 -->
				<button
					class="icon-btn secondary grid-area-trailing"
					type="button"
					aria-label="send prompt"
					@click="isStreaming ? stopStreaming() : sendMessage()"
				>
					<template v-if="isStreaming"><Stop /></template>
					<template v-else><ArrowUp /></template>
				</button>

				<!-- 隐藏的文本框 -->
				<textarea
					class="hidden-textarea"
					id="hidden-textarea"
					autofocus
					@focus="isFocus = true"
					@blur="isFocus = false"
					disabled
					style="display: none"
				></textarea>
			</div>
			<button class="scroll-bottom-btn" @click="scorllToBottom">
				<ArrowDown />
			</button>
		</div>
	</div>
</template>

<style scoped>
/* 非主要功能 */
.page-title {
	color: var(--text-primary);
	font-size: 24px;
	position: absolute;
	width: 100%;
	height: 100%;
	top: 0;
	text-align: center;
	align-content: center;
}
.page-back {
	position: fixed;
	width: 100%;
	transform: rotate(-90deg);
	color: var(--text-primary);
	top: var(--spacing);
	left: var(--spacing);
	border-radius: 50%;
	/* 背景模糊 */
	backdrop-filter: blur(10px);
	padding: calc(var(--spacing) * 0.5);
	border: none !important;
}
.ai-info {
	height: 2.25rem;
	font-weight: 400;
	width: fit-content;
	position: fixed;
	color: var(--text-primary);
	top: var(--spacing);
	left: calc(var(--spacing) * 4 + 2.25rem);
	background-color: transparent;
	display: flex;
	flex-direction: row;
	gap: calc(var(--spacing) * 3);
	align-items: center;
	justify-content: center;
}
.ai-info-item {
	height: 100%;
	padding-inline: calc(var(--spacing) * 4);
	text-align: center;
	align-content: center;
	border-radius: 28px;
	backdrop-filter: blur(10px);
	background-color: transparent;
	margin: 0;
	font-size: medium;
	/* 删除select默认样式 */
	-webkit-appearance: none;
	-moz-appearance: none;
	appearance: none;
	outline: none;
	border: none;
}

/* markdown渲染 */
.markdown-style :deep(*) {
	font-family: inherit;
	font-size: inherit;
	line-height: inherit;
	color: inherit;
	outline: none;
	border: none;
	background-color: transparent;
}

.markdown-style :deep(ul) {
	padding-left: 30px;
	outline: none;
	border: none;
	background-color: transparent;
}

/* 主要功能 */
.chat-container {
	height: 100%;
	position: relative;
	overflow-y: auto;
	background-color: var(--bg-color);
	color-scheme: light dark;

	--spacing: 0.25rem;

	--bg-primary: #fff;
	--bg-primary-inverted: #000;
	--bg-secondary: #e8e8e8;
	--bg-tertiary: #f3f3f3;
	--bg-scrim: #0d0d0d80;

	--text-primary: #0d0d0d;
	--text-secondary: #5d5d5d;
	--text-tertiary: #8f8f8f;
	--text-inverted: #fff;

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
}

/* 暗色模式 */
@media (prefers-color-scheme: dark) {
	.chat-container {
		--bg-color: rgba(33, 33, 33, 1);
		--bg-primary: #212121;
		--bg-primary-inverted: #fff;
		--bg-secondary: #303030;
		--bg-tertiary: #414141;
		--bg-scrim: #0d0d0d80;

		--text-primary: #fff;
		--text-secondary: #f3f3f3;
		--text-tertiary: #afafaf;
		--text-inverted: #0d0d0d;

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
	}
}

.chat-msg-container {
	display: flex;
	flex-direction: column;
	height: auto;
	min-height: calc(100% - var(--spacing) * 19 - var(--spacing) * 10); /* 让输入框处于最下方 */
	padding-top: calc(var(--spacing) * 10);
	width: 100%;
	background-color: transparent;
}
/* all msg */
.chat-msg {
	background-color: transparent;
	padding-inline: calc(var(--spacing) * 4);
}
/* ai msg */
.chat-msg-ai {
	background-color: transparent;
}
.chat-msg-ai > .chat-msg-content {
	background-color: transparent;
}
/* user msg */
.chat-msg-user {
	background-color: transparent;
	gap: calc(var(--spacing) * 1);
	padding-top: calc(var(--spacing) * 3);
	display: flex;
	flex-direction: column;
	align-items: flex-end;
}
.chat-msg-user > .chat-msg-content {
	padding-block: calc(var(--spacing) * 3); /* multline 3 line 1.5 */
	padding-inline: calc(var(--spacing) * 4);
	border-radius: 18px;
	max-width: var(--user-chat-width, 70%);
	display: block;
	width: fit-content;
	/* 在屏幕右侧 */
	justify-self: start;
	align-self: flex-end;
	align-items: baseline;
	background-color: rgba(233, 233, 233, 0.5);
}

.chat-msg-content {
	white-space: pre-wrap;
	word-wrap: break-word;
	word-break: break-all;
	overflow-wrap: break-word;
	font-size: 16px;
	color: var(--text-primary);
	text-align: left;
}

/* action */
.action-wrapper {
	display: flex;
	justify-content: flex-end;
	position: relative;
	z-index: 0;
	background-color: transparent;
}

.chat-msg-user .action-wrapper {
	justify-content: flex-end;
}
.chat-msg-ai .action-wrapper {
	justify-content: flex-start;
	transform: translateX(calc(var(--spacing) * -2));
}

.action-container {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 0;
	padding: 0.25rem; /* p-1 */
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

.chat-msg:hover .action-container,
.chat-msg:focus-within .action-container,
.action-container[data-state='open'] {
	opacity: 1;
	pointer-events: auto;
}
/* 最后一项永远显示 */
.chat-msg:last-child .action-container {
	opacity: 1;
	pointer-events: auto;
}

/* 按钮样式 */
.action-btn {
	color: var(--text-secondary);
	background-color: transparent;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 0.25rem; /* 可根据需要调整 */
	cursor: pointer;
	transition: background-color 0.2s;
	border: transparent solid 1px;
	width: 32px;
	height: 32px;
	border-radius: 0.5rem; /* rounded-lg */
}

.action-btn:active {
	background-color: var(--bg-secondary);
}

.action-btn:hover {
	background-color: var(--bg-secondary);
}

/* input-container */
.chat-input-container {
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
.chat-input-container::after {
	content: '';
	position: absolute;
	inset: 0;
	pointer-events: none;
	--fade-height: 128px;
	z-index: -1;
	background: linear-gradient(
		to bottom,
		transparent calc(100% - var(--fade-height)),
		var(--bg-color) 100%
	);
}

/* toBottom */
.scroll-bottom-btn {
	position: absolute;
	/* cursor-pointer: pointer; */
	z-index: 30;
	/* bg-clip-padding: border; */
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
	opacity: 0;
	transition: opacity 0.2s ease-in-out;
	backdrop-filter: blur(10px);
	background-color: transparent;
}

/* input */
.chat-input {
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

.chat-input.multiline {
	grid-template-areas:
		'header header header'
		'primary primary primary'
		'leading footer trailing';
	grid-template-columns: auto 1fr auto;
	grid-template-rows: auto auto auto;
}

.grid-area-header {
	grid-area: header;
}
.grid-area-footer {
	grid-area: footer;
}
.grid-area-trailing {
	grid-area: trailing;
}
.grid-area-leading {
	grid-area: leading;
}
.grid-area-primary {
	grid-area: primary;
}

.chat-input .chat-input-editor {
	background-color: transparent;
	padding-block: calc(var(--spacing) * 1.5);
	padding-inline: calc(var(--spacing) * 2.5);
	min-height: calc(var(--spacing) * 6);
	max-height: calc(var(--spacing) * 40); /* 49 */
	/* scoll */
	overflow-y: auto;
	white-space: pre-wrap;
	word-wrap: break-word;
	word-break: break-all;
	overflow-wrap: break-word;
	min-width: 0;
	will-change: height;
}
/* .chat-input.multiline .chat-input-editor {
} */

.chat-input.disabled {
	opacity: 0.5;
}

/* placeholder  */
/* .chat-input .chat-input-editor:empty:before 也可使用 :empty */
.chat-input .chat-input-editor[data-empty='true']:before {
	position: absolute;
	content: attr(placeholder);
	color: var(--placeholder-color);
	pointer-events: none;
}

.chat-input .chat-input-editor:focus {
	/* remove browser default outline */
	outline: none;
}

.chat-input .chat-input-bar {
	display: flex;
}

.chat-input .hidden-textarea {
	display: none;
}

.icon-btn {
	border: none;
	background-color: transparent;
	cursor: pointer;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 2.25rem;
	height: 2.25rem;
}
.icon-btn.primary {
	background-color: var(--btn-bg-primary);
	color: var(--btn-icon-primary);
	border: none;
	outline: none;
	border-radius: 50%;
	-webkit-tap-highlight-color: transparent;
}
.icon-btn.primary:hover {
	background-color: var(--btn-bg-primary-hover);
}
.icon-btn.primary:active {
	background-color: var(--btn-bg-primary-active);
}
.icon-btn.secondary {
	background-color: var(--btn-bg-secondary);
	color: var(--btn-icon-secondary);
	border: none;
	outline: none;
	border-radius: 50%;
	-webkit-tap-highlight-color: transparent;
}
.icon-btn.secondary:hover {
	background-color: var(--btn-bg-secondary-hover);
}
.icon-btn.secondary:active {
	background-color: var(--btn-bg-secondary-active);
}

/* 640px 适配 */
@media (max-width: 640px) {
}
</style>
