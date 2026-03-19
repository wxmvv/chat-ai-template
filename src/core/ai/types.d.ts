export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';
export type FinishReason =
	| 'stop'
	| 'length'
	| 'content-filter'
	| 'tool-calls'
	| 'error'
	| 'other';

export interface TextContentPart {
	type: 'text';
	text: string;
}

export interface Message {
	role: MessageRole;
	content: string | TextContentPart[];
	name?: string;
}

export interface ModelInfo {
	id: string;
	object: string;
	created?: number;
	ownedBy?: string;
	provider: string;
}

export interface ModelListResponse {
	object: string;
	provider: string;
	data: ModelInfo[];
}

export interface BalanceInfo {
	currency?: string;
	total_balance?: number;
	available_balance?: number;
}

export interface BalanceResponse {
	object: string;
	provider: string;
	data: BalanceInfo | null;
}

export interface LanguageModelUsage {
	inputTokens?: number;
	outputTokens?: number;
	totalTokens?: number;
}

export interface ReasoningPart {
	type: 'reasoning';
	text: string;
}

export interface TextPart {
	type: 'text';
	text: string;
}

export interface FinishPart {
	type: 'finish';
	finishReason: FinishReason;
	usage?: LanguageModelUsage;
}

export type StreamPart = ReasoningPart | TextPart | FinishPart;

export interface StreamStartEvent {
	model: {
		provider: string;
		modelId: string;
	};
	messages: Message[];
}

export interface StreamTextResult {
	provider: string;
	modelId: string;
	messages: Message[];
	text: string;
	reasoning: string;
	finishReason: FinishReason;
	usage: LanguageModelUsage;
}

export interface StreamTextOptions {
	system?: string | Message | Message[];
	prompt?: string;
	messages?: Message[];
	maxOutputTokens?: number;
	temperature?: number;
	topP?: number;
	topK?: number;
	frequencyPenalty?: number;
	presencePenalty?: number;
	stopSequences?: string[];
	seed?: number;
	headers?: Record<string, string | undefined>;
	providerOptions?: Record<string, unknown>;
	abortSignal?: AbortSignal;
	onStart?: (event: StreamStartEvent) => void;
	onResponse?: (response: Response) => void;
	onChunk?: (part: StreamPart) => void;
	onText?: (text: string, part: TextPart) => void;
	onReasoning?: (text: string, part: ReasoningPart) => void;
	onFinish?: (result: StreamTextResult) => void;
	onError?: (error: unknown) => void;
	onAbort?: () => void;
	onFinally?: () => void;
}

export interface StreamController {
	provider: string;
	modelId: string;
	abort: () => void;
	isStreaming: () => boolean;
	completion: Promise<StreamTextResult>;
}

export interface LanguageModel {
	specificationVersion: 'v1';
	provider: string;
	modelId: string;
	streamText: (options?: StreamTextOptions) => StreamController;
}

export interface ProviderCallOptions {
	headers?: Record<string, string | undefined>;
}

export interface Provider {
	provider: string;
	defaultModelId: string;
	languageModel: (modelId?: string, modelOptions?: Record<string, unknown>) => LanguageModel;
	listModels: (options?: ProviderCallOptions) => Promise<ModelListResponse>;
	getBalance: (options?: ProviderCallOptions) => Promise<BalanceResponse>;
}

export interface ProviderFactoryOptions {
	baseURL?: string;
	headers?: Record<string, string>;
	defaultModelId?: string;
	fetch?: typeof fetch;
}
