// src/handlers/index.ts

import type { Blob } from '@google/genai';
import type { CallbackQuery, Message } from '@/types';
import { FileHandler } from './files';
import { CallbackQueryHandler } from './callback_query';

export { handleUpdate } from './update';

export const handleCallbackQuery = async (callbackQuery: CallbackQuery): Promise<void> => {
  const callback = new CallbackQueryHandler(callbackQuery);
  return await callback.process();
};

export const handleFile = async (message: Message): Promise<Blob | undefined> => {
  const file = new FileHandler(message);
  return await file.process();
};
