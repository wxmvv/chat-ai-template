import type { AIApi, ChatStreamConfig, ChatStreamInstance, ModelInfo, ModelListResponse, BalanceInfo, BalanceResponse } from './ai-types';

export { ChatStreamConfig, ChatStreamInstance, ModelInfo, ModelListResponse, BalanceInfo, BalanceResponse };

export interface OllamaAPI extends AIApi {}

export const ollama: OllamaAPI;

export default ollama;