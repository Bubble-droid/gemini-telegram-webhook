// src/handlers/message/index.ts

import type { Message } from '@/types';
import { MentionHandler } from './mention';
export { handleCommand } from './command';
export { handleNewMember } from './new_member';
export { handleNormal } from './normal';

export const handleMention = async (message: Message): Promise<void> => {
  const mention = new MentionHandler(message);
  return await mention.process();
};
