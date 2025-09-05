// src/handlers/update.ts

import type { Message, MessageEntity, ReplyMarkup, Update } from '@/types';
import { config, Log, REACTiON_ROW, bot } from '@/services';
import { handleMention, handleCommand, handleNewMember, handleNormal } from '@/handlers/message';
import { scheduleDeletion, sendErrorNotification, shortenString } from '@/utils';
import { escaper } from '@/utils/formatting';
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
  Log.info('Handling Telegram update', { update: simpleUpdateLog(update) });
  const { botName, allowGroups } = config.load();
  if (update.callback_query) {
    const { callback_query } = update;
    if (callback_query && callback_query.message && callback_query.data) return await handleCallbackQuery(callback_query);
  }
  if (!update.message) return;
  const { update_id, message } = update;
  if (message.sticker) return;
  const { message_id, chat } = message;
  if (!allowGroups.includes(chat.id) || chat.type === 'private') return;
  if (message.new_chat_members && message.new_chat_members.length > 0) return await handleNewMember(message);

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
    const shorten = `<blockquote expandable>${escaper.html(shortenString(`❌ ${errorMessage}`))}</blockquote>`;
    const replyMarkup: ReplyMarkup = {
      inline_keyboard: [REACTiON_ROW],
    };
    const errorResult = await bot.sendMessage(chat.id, shorten, { replyToMessageId: message_id, parseMode: 'HTML', replyMarkup });
    if (errorResult.ok) {
      scheduleDeletion({ chat_id: chat.id, message_id: errorResult.messageId }, 3 * 60_000);
    }
  }
};

/**
 * 辅助函数：简化单个 Message 对象
 * @param message - 原始的 Message 对象
 * @returns 简化后的 Message 对象或 undefined
 */
const simplifyMessage = (message: Message | undefined): Message | undefined => {
  if (!message) {
    return undefined;
  }

  // 辅助函数：用于截断文本
  const truncate = (text?: string): string | undefined => (text ? `${text.slice(0, 20)}...` : undefined);

  const filterEntity = (entities: MessageEntity[] | undefined): MessageEntity[] | undefined =>
    entities ? entities?.filter((e) => ['text_mention', 'mention', 'bot_command'].includes(e.type)) : undefined;

  // 创建 message 的一个副本并进行修改
  const simplified: Message = { ...message };

  if (simplified.text) {
    simplified.text = truncate(simplified.text);
  } else if (simplified.caption) {
    simplified.caption = truncate(simplified.caption);
  }

  if (simplified.entities) {
    simplified.entities = filterEntity(simplified.entities);
  } else if (simplified.caption_entities) {
    simplified.caption_entities = filterEntity(simplified.caption_entities);
  }

  if (simplified.reply_to_message) {
    simplified.reply_to_message = simplifyMessage(simplified.reply_to_message);
  }

  // 单独处理 reply_markup 以避免复杂嵌套
  if (simplified.reply_markup?.inline_keyboard) {
    simplified.reply_markup = {
      ...simplified.reply_markup,
      // 只保留第一行按钮
      inline_keyboard: [simplified.reply_markup.inline_keyboard[0]],
    };
  }

  return simplified;
};

/**
 * 主函数：简化整个 Update 对象用于日志记录
 * @param update - 原始的 Update 对象
 * @returns 简化后的 Update 对象
 */
const simpleUpdateLog = (update: Update): Update => {
  // 创建 update 的浅拷贝
  const newUpdate: Update = { ...update };

  // 使用辅助函数简化各种消息
  if (newUpdate.message) {
    newUpdate.message = simplifyMessage(newUpdate.message);
  }

  if (newUpdate.edited_message) {
    newUpdate.edited_message = simplifyMessage(newUpdate.edited_message);
  }

  if (newUpdate.callback_query?.message) {
    newUpdate.callback_query = {
      ...newUpdate.callback_query,
      message: simplifyMessage(newUpdate.callback_query.message),
    };
  }

  return newUpdate;
};

export { handleUpdate };
