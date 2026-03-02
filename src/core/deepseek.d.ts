export interface ChatStreamConfig {
	api?: string;
	headers?: Record<string, string>;
	model?: string;

	onStart?: () => void;
	onResponse?: (response: Response) => void;
	onToken?: (token: string) => void;
	onError?: (error: unknown) => void;
	onAbort?: () => void;
	onEnd?: () => void;
}

export interface ChatStreamInstance {
	start: (
		question: string,
		extraPayload?: Record<string, any>
	) => Promise<void>;
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

export interface DeepSeekAPI {
	createChatStream: (config?: ChatStreamConfig) => ChatStreamInstance;
	getModelList: (
		headers?: Record<string, string>
	) => Promise<ModelListResponse>;
	getBalance: (headers?: Record<string, string>) => Promise<BalanceResponse>;
}

export const deepseek: DeepSeekAPI;

export default deepseek;
