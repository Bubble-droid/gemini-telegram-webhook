// src/handlers/message/index.ts

import type { Message } from '@/types';
import { MentionHandler } from './mention';
import { NormalHandler } from './normal';

export { handleCommand } from './command';
export { handleNewMember } from './new_member';

export const handleMention = async (message: Message): Promise<void> => {
  const mention = new MentionHandler(message);
  return await mention.process();
};

export const handleNormal = async (message: Message): Promise<void> => {
  const normal = new NormalHandler(message);
  return await normal.process();
};
