import type { Provider, ProviderFactoryOptions } from './types';

export * from './types';

export function deepseek(options?: ProviderFactoryOptions): Provider;
export function ollama(options?: ProviderFactoryOptions): Provider;
