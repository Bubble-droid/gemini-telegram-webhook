// src/handlers/message/index.ts

import type { Message } from '@/types';
import { MentionHandler } from './mention';

export * from './command';
export * from './new_member';
export * from './normal';

export const handleMention = async (message: Message): Promise<void> => {
  const mention = new MentionHandler(message);
  return await mention.handleMention();
};
