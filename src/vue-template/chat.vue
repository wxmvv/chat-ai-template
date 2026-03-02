<script setup>
import { ref, computed } from 'vue';
import ArrowUp from '../icon/arrowUp.svg?component';
import Plus from '../icon/plus.svg?component';
import Stop from '../icon/stop.svg?component';

import markdownit from 'markdown-it';
const md = markdownit({
	// Enable HTML tags in source
	html: true,
	xhtmlOut: true,
	breaks: true,
	langPrefix: 'language-',
	linkify: false,
	typographer: false,
	quotes: '“”‘’'
}).enable('table');

import deepseek from '../core/deepseek';
import ollama from '../core/ollama';
import { UUID } from '../core/utils';

const pageTitle = ref('vue-chat-ai-demo');
const showBack = ref(true);
const goBack = () => {
	document.querySelector('#vue-app').style.display = 'none';
	document.querySelector('#app').style.display = 'flex';
};

const aiList = {
	deepseek,
	ollama
};
const ai = aiList.ollama;
const aiName = 'ollama';

// input state
const inputValue = ref('');
const editorRef = ref(null);
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

// emit
const emit = defineEmits(['submit', 'focus', 'blur']);

// send message
const sendMessage = async (question = inputValue.value) => {
	console.log('sendMessage', question);
	if (!question.trim()) return;
	messages.value.push({
		id: UUID(),
		type: 'user', // ai | user
		content: question,
		timestamp: Date.now(),
		status: 'sent'
	});
	clear();

	const contentRef = ref('');
	chatStreamRef.value = ai.createChatStream({
		onStart: () => (isStreaming.value = true),
		onResponse: (r) => {
			console.log('streaming', r);
			messages.value.push({
				id: UUID(),
				type: 'ai', // ai | user
				content: contentRef,
				timestamp: Date.now(),
				status: 'sent'
			});
		},
		onToken: (t) => {
			contentRef.value += t;
		},
		onError: (err) => console.log(err),
		onAbort: () => console.log('abort success'),
		onEnd: () => (isStreaming.value = false)
	});
	await chatStreamRef.value.start(question);
};

const stopStreaming = () => {
	chatStreamRef.value.abort();
};

// handler
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
	updateMultiline();
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

// func
const clear = () => {
	inputValue.value = '';
	editorRef.value.innerHTML = '';
};

const updateMultiline = () => {
	const el = editorRef.value;
	if (!el) return;

	const lineHeight = 24; // 和 CSS 保持一致
	isMultiline.value = el.scrollHeight > lineHeight + 2;
};
</script>

<template>
	<!-- 输入框 -->
	<div class="chat-container">
		<div class="chat-msg-container">
			<div v-if="!hasMessages" class="page-title">{{ pageTitle }}</div>
			<button v-if="showBack" class="icon-btn page-back" @click="goBack">
				<ArrowUp />
			</button>
			<div class="ai-info">{{ aiName }}</div>
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
						{{ message.content }}
					</div>
				</template>
				<template v-else-if="message.type === 'ai'">
					<!-- markdown 渲染 -->
					<div
						class="chat-msg-content"
						v-html="md.render(message.content)"
					></div>
				</template>
				<template v-else>
					<!-- 纯文本渲染 -->
					<div class="chat-msg-content">
						{{ message.content }}
					</div>
				</template>
			</div>
		</div>
		<div class="chat-input-container">
			<div
				class="chat-input"
				:class="{ focus: isFocus, disabled }"
				@click.stop
			>
				<div
					class="chat-input-editor grid-area-primary"
					data-empty="true"
					:contenteditable="!disabled"
					:placeholder
					ref="editorRef"
					@input="handleInput"
					@keydown="handleKeydown"
					@focus="handleFocus"
					@blur="handleBlur"
					@compositionstart="onCompositionStart"
					@compositionend="onCompositionEnd"
				></div>

				<button
					class="icon-btn primary grid-area-leading"
					type="button"
					aria-label="send prompt"
				>
					<Plus />
				</button>

				<button
					class="icon-btn secondary grid-area-trailing"
					type="button"
					aria-label="send prompt"
					@click="isStreaming ? stopStreaming() : sendMessage()"
				>
					<template v-if="isStreaming"><Stop /></template>
					<template v-else><ArrowUp /></template>
				</button>

				<textarea
					class="hidden-textarea"
					id="hidden-textarea"
					autofocus
					@keydown="handleKeydown"
					@focus="isFocus = true"
					@blur="isFocus = false"
					disabled
				></textarea>
			</div>
		</div>
	</div>
</template>

<style scoped>
/* 居中显示 */
.page-title {
	color: var(--text-color);
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
	color: var(--text-color);
	top: var(--spacing);
	left: var(--spacing);
	border-radius: 50%;
	/* 背景模糊 */
	backdrop-filter: blur(10px);
	padding: calc(var(--spacing) * 0.5);
	border: #f5f1f1 solid 1px !important;
}
.ai-info {
	height: 2.25rem;
	font-weight: 400;
	width: fit-content;
	position: fixed;
	color: var(--text-color);
	top: var(--spacing);
	left: calc(var(--spacing) * 3 + 2.25rem);
	border-radius: 28px;
	backdrop-filter: blur(10px);
	background-color: transparent;
	padding-inline: calc(var(--spacing) * 4);
	text-align: center;
	align-content: center;
}

.chat-container {
	height: 100%;
	position: relative;
	overflow-y: auto;
	background-color: var(--bg-color);
	color-scheme: light dark;

	--bg-color: rgba(255, 255, 255, 1);
	--spacing: 0.25rem;
	--text-color: rgba(0, 0, 0, 1);
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
	--btn-bg-secondary-hover: rgba(0, 0, 0, 1);
	--btn-bg-secondary-active: rgba(0, 0, 0, 0.05);
	--btn-icon-secondary: #fff;

	--user-chat-width: 70%;
}

/* 暗色模式 */
@media (prefers-color-scheme: dark) {
	.chat-container {
		--bg-color: rgba(33, 33, 33, 1);
		--text-color: rgba(255, 255, 255, 1);
		--placeholder-color: rgba(153, 153, 153, 1);

		--input-bg: #303030;
		--input-shadow:
			rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px,
			rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px,
			rgba(0, 0, 0, 0.1) 0px 4px 12px 0px,
			rgba(255, 255, 255, 0.2) 0px 0px 1px 0px inset;

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
	min-height: calc(100% - var(--spacing) * 19); /* 让输入框处于最下方 */
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
	color: var(--text-color);
	text-align: left;
}

.chat-input-container {
	display: flex;
	padding-bottom: calc(var(--spacing) * 5);
	padding-inline: calc(var(--spacing) * 5);
	border: none;
	background: transparent;
	color: var(--text-color);
	cursor: text;
	isolation: isolate;
	position: sticky;
	bottom: 0;
}

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
	max-height: calc(var(--spacing) * 49);
	/* scoll */
	overflow-y: auto;
	white-space: pre-wrap;
	word-wrap: break-word;
	word-break: break-all;
	overflow-wrap: break-word;
	min-width: 0;
}

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
