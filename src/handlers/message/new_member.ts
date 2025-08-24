// src/handlers/message/new_member.ts

import { Log, BotConfig, TelegramBot } from '@/services';
import type { Message, User } from '@/types/telegram';
import { KvNamespace, scheduleDeletion } from '@/utils';

/**
 * @function handleNewMember
 * @description 处理新成员加入聊天的消息。
 * @param {Message} message - Telegram Message 对象。
 * @returns {Promise<void>}
 */
const handleNewMember = async (message: Message): Promise<void> => {
  const { botName, durableResourceId, newMemberWelcomeTextKeyName } = BotConfig.load();
  const { chat, new_chat_members } = message;
  const newMemberIds = new_chat_members?.map((member) => member.id) as number[];
  Log.info('Handling new chat member message', { chatId: chat.id, newMemberIds: newMemberIds.join(', ') });
  for (const newMember of new_chat_members as User[]) {
    const { id: newMemberId, first_name, last_name = '' } = newMember;
    const newMemberFullName = `${first_name} ${last_name}`;
    const newMemberMention = `[${newMemberFullName}](tg://user?id=${newMemberId})`;
    const newMemberWelcomeText = await KvNamespace.read<string>(durableResourceId, newMemberWelcomeTextKeyName, 'text');
    const replaceText = newMemberWelcomeText
      ?.replace('NEW_MEMBER_MENTION', newMemberMention)
      .replace('CHAT_TITLE', chat.title as string)
      .replace('BOT_NAME', botName) as string;
    const welcomeResult = await TelegramBot.sendMessage(chat.id, replaceText, 'HTML');
    if (welcomeResult.ok) {
      void scheduleDeletion({ chat_id: chat.id, message_id: welcomeResult.messageId }, 10 * 60_000);
    }
  }
};

export { handleNewMember };
