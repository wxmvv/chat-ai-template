import type {
	AIApi,
	ChatStreamConfig,
	ChatStreamInstance,
	ModelInfo,
	ModelListResponse,
	BalanceInfo,
	BalanceResponse
} from './ai-types';

export {
	ChatStreamConfig,
	ChatStreamInstance,
	ModelInfo,
	ModelListResponse,
	BalanceInfo,
	BalanceResponse
};

export interface DeepSeekAPI extends AIApi {}

export const deepseek: DeepSeekAPI;

export default deepseek;
