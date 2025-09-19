// src/services/index.ts

export { config } from './ConfigLoader';
import { TelegramBot } from './TelegramBot';

export * from './ChatContexts';
export * from './AppError';
export * from './GeminiApi';
export * from './Logger';
export { makeInlineKeyboard } from './TelegramBot';
export * from './ToolExecutors';

export const bot: TelegramBot = new TelegramBot();
