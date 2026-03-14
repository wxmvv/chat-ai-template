export interface ChatStreamConfig {
	api?: string;
	headers?: Record<string, string>;
	model?: string;

	onStart?: () => void;
	onResponse?: (response: Response) => void;
	onToken?: (token: string, thinking: boolean) => void;
	onError?: (error: unknown) => void;
	onAbort?: () => void;
	onEnd?: () => void;
	onThinkingStart?: () => void;
	onThinkingEnd?: () => void;
	onFinally?: () => void;
}

export interface ChatStreamInstance {
	ask: (question: string, extraPayload?: Record<string, any>) => Promise<void>;
	chat: (messages: Messages, extraPayload?: Record<string, any>) => Promise<void>;
	abort: () => void;
	isStreaming: () => boolean;
}

export interface ModelInfo {
	id: string;
	object: string;
	created?: number;
	owned_by?: string;
}

export interface ModelListResponse {
	object: string;
	data: ModelInfo[];
}

export interface BalanceInfo {
	currency?: string;
	total_balance?: number;
	available_balance?: number;
}

export interface BalanceResponse {
	object?: string;
	data?: BalanceInfo;
}

export interface AIApi {
	createChatStream: (config?: ChatStreamConfig) => ChatStreamInstance;
	getModelList: (headers?: Record<string, string>) => Promise<ModelListResponse>;
	getBalance: (headers?: Record<string, string>) => Promise<BalanceResponse>;
}

export type messageRole = 'user' | 'assistant' | 'system' | 'tool';
export type messageType = 'text' | 'image' | 'audio' | 'video' | 'file';

export interface Message {
	role: messageRole;
	content: string;
	name?: string;
	type?: messageType;
	image?: string;
	function_call?: {
		name: string;
		arguments: string;
	};
}

export type Messages = Message[];
