// src/handlers/update.ts

import type { Update } from '@/types';
import { BotConfig, Log, TelegramBot } from '@/services';
import { handleMention, handleCommand, handleNewMember, handleNormal } from '@/handlers/message';
import { scheduleDeletion, sendErrorNotification, shortenString } from '@/utils';
import { escapeHtml } from '@/utils/formatting';
import { handleCallbackQuery } from './callback_query';

/**
 * @function handleUpdate
 * @description 处理接收到的 Telegram 更新对象。
 *              根据更新的类型（例如消息、编辑消息、回调查询等）将请求分发到相应的处理函数。
 *              消息处理优先级：提及 > 带 @botName 的命令 > 新成员 > 普通消息。
 * @param {Update} update - Telegram 更新对象，包含一个事件的所有信息。
 * @returns {Promise<void>} 此函数不返回任何值，但会触发其他处理逻辑。
 */
const handleUpdate = async (update: Update): Promise<void> => {
  Log.info('Handling Telegram update', { update });
  const { botName, allowGroups } = BotConfig.load();
  if (!update.message) return;
  const { update_id, message, callback_query } = update;
  if (message.sticker) return;
  const { message_id, chat } = message;
  if (!allowGroups.includes(chat.id) || chat.type === 'private') return;
  if (message.new_chat_members && message.new_chat_members.length > 0) return await handleNewMember(message);
  if (callback_query && callback_query.message && callback_query.data) return await handleCallbackQuery(callback_query);
  const messageText = message.text || message.caption || null;
  const messageEntities = message.entities || message.caption_entities || null;
  if (!messageEntities || !messageText) return await handleNormal(message);
  try {
    for (const entity of messageEntities) {
      if (entity.type === 'mention' || entity.type === 'text_mention') {
        const mentionedText = messageText.substring(entity.offset, entity.offset + entity.length);
        if (mentionedText === `@${botName}`) {
          return await handleMention(message);
        }
      }
    }
    for (const entity of messageEntities) {
      if (entity.type === 'bot_command') {
        const commandText = messageText.substring(entity.offset, entity.offset + entity.length);
        const atIndex = commandText.indexOf('@');
        if (atIndex !== -1) {
          const mentionedTarget = commandText.slice(atIndex + 1);
          if (mentionedTarget === botName) {
            return await handleCommand(message);
          }
        }
      }
    }
  } catch (error: unknown) {
    const err = error as Error;
    Log.error('Error while handling update', { err, updateId: update_id });
    await sendErrorNotification(err, `Error while handling update ${JSON.stringify({ chatId: chat.id, messageId: message_id })}`);
    const errorMessage: string = err instanceof Error ? err.message : String(err);
    const shorten = `<blockquote expandable>${escapeHtml(shortenString(`❌ ${errorMessage}`))}</blockquote>`;
    const errorResult = await TelegramBot.sendMessage(chat.id, shorten, message_id);
    if (errorResult.ok) {
      void scheduleDeletion({ chat_id: chat.id, message_id: errorResult.messageId }, 3 * 60_000);
    }
  }
};

export { handleUpdate };
