// src/handlers/update.ts

import type { InlineKeyboardMarkup, Message, MessageEntity, ReplyMarkup, Update } from '@/types';
import { config, Log, REACTiON_ROW, bot, AppError } from '@/services';
import { handleMention, handleCommand, handleNewMember, handleNormal } from '@/handlers/message';
import { scheduleDeletion, sendErrorNotification, shortenString } from '@/utils';
import { escaper } from '@/utils/formatters';
import { handleCallbackQuery } from '@/handlers';

/**
 * @function handleUpdate
 * @description 处理接收到的 Telegram 更新对象。
 *              根据更新的类型（例如消息、编辑消息、回调查询等）将请求分发到相应的处理函数。
 *              消息处理优先级：提及 > 带 @botName 的命令 > 新成员 > 普通消息。
 * @param {Update} update - Telegram 更新对象，包含一个事件的所有信息。
 * @returns {Promise<void>} 此函数不返回任何值，但会触发其他处理逻辑。
 */
export const handleUpdate = async (update: Update): Promise<void> => {
  const { botName, allowGroups } = config.load();
  const { update_id, message, callback_query } = update;
  if (message?.sticker) return;
  Log.info('Handling Telegram update', { update: simplifyUpdateLog(update) });
  if (!message && !callback_query) return;
  const msg = message || callback_query?.message;
  if (!msg) {
    Log.warn('No message or callback_query message found in update to process chat info', { updateId: update_id });
    return;
  }
  const { message_id, chat } = msg;
  if (!allowGroups.includes(chat.id) || chat.type === 'private') return;
  const messageText = msg.text || msg.caption || '';
  const messageEntities = msg.entities || msg.caption_entities || [];
  try {
    if (callback_query?.data) {
      return await handleCallbackQuery(callback_query);
    }
    if (msg.new_chat_members) {
      return await handleNewMember(msg);
    }
    if (messageEntities.length > 0) {
      for (const entity of messageEntities) {
        if (entity.type === 'mention' || entity.type === 'text_mention') {
          const mentionedText = messageText.substring(entity.offset, entity.offset + entity.length);
          if (mentionedText === `@${botName}`) {
            return await handleMention(msg);
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
              return await handleCommand(msg);
            }
          }
        }
      }
    }
    return await handleNormal(msg);
  } catch (err: unknown) {
    const errorMessage: string = err instanceof AppError ? err.message : String(err);
    Log.error('Error while handling update', { err, updateId: update_id });
    sendErrorNotification(err as AppError, `Error while handling update ${JSON.stringify({ chatId: chat.id, messageId: message_id })}`);
    const shorten = `<blockquote expandable>${escaper.html(shortenString(`❌ ${errorMessage}`))}</blockquote>`;
    const replyMarkup: ReplyMarkup = {
      inline_keyboard: [REACTiON_ROW],
    };
    const errorResult = await bot.sendMessage(chat.id, shorten, { replyToMessageId: message_id, parseMode: 'HTML', replyMarkup });
    if (errorResult.ok) {
      scheduleDeletion(chat.id, errorResult.messageId, 3 * 60_000);
    }
  }
};

/**
 * 辅助函数：安全地创建一个简化的 Message 对象副本。
 * 此函数是纯函数，保证不会修改原始 message 对象。
 * @param message - 原始的 Message 对象
 * @returns 一个全新的、简化后的 Message 对象，或 undefined
 */
const simplifyMessage = (message: Message | undefined): Message | undefined => {
  if (!message) {
    return undefined;
  }

  // 辅助函数：用于截断文本（保持不变，它是纯函数）
  const truncate = (text?: string): string | undefined => (text ? (text.length > 20 ? `${text.slice(0, 20)}...` : text) : undefined);

  // 辅助函数：用于过滤实体（保持不变，.filter 返回新数组，是纯函数）
  const filterEntity = (entities: MessageEntity[] | undefined): MessageEntity[] | undefined =>
    entities?.filter((e) => ['text_mention', 'mention', 'bot_command'].includes(e.type));

  // 直接构建并返回一个全新的 Message 对象
  return {
    ...message, // 1. 基础：浅拷贝所有原始属性

    // 2. 覆盖需要修改的属性
    text: truncate(message.text),
    caption: truncate(message.caption),
    entities: filterEntity(message.entities),
    caption_entities: filterEntity(message.caption_entities),

    photo: message.photo && message.photo.length > 0 ? [{ ...message.photo[message.photo.length - 1] }] : message.photo,

    // 3. 递归调用，用返回的新对象覆盖 reply_to_message
    reply_to_message: simplifyMessage(message.reply_to_message),

    // 4. 安全地处理 reply_markup
    reply_markup: message.reply_markup?.inline_keyboard?.[0]
      ? {
          // 如果需要修改，则创建一个全新的 reply_markup 对象
          ...(message.reply_markup as InlineKeyboardMarkup), // 复制其他可能的顶层属性
          inline_keyboard: [
            // 创建一个只包含第一行的新数组。
            // 并且，使用 .map 对第一行的所有按钮进行浅拷贝，
            // 彻底断开与原始按钮对象的引用关系。
            message.reply_markup.inline_keyboard[0].map((button) => ({ ...button })),
          ],
        }
      : message.reply_markup, // 如果无需修改，则保持原始引用
  };
};

/**
 * 主函数：创建一个简化的 Update 对象副本用于日志记录。
 * 此函数现在是完全安全的，因为它依赖于纯函数 simplifyMessage。
 * @param update - 原始的 Update 对象
 * @returns 一个全新的、与原始数据完全解耦的简化版 Update 对象
 */
export const simplifyUpdateLog = (update: Update): Update => {
  // 1. 创建 update 的浅拷贝，这是正确的起点
  const newUpdate: Update = { ...update };

  // 2. 对可能存在的 message 对象应用纯函数进行简化
  if (newUpdate.message) {
    newUpdate.message = simplifyMessage(newUpdate.message);
  }

  if (newUpdate.edited_message) {
    newUpdate.edited_message = simplifyMessage(newUpdate.edited_message);
  }

  // 3. 对 callback_query 的处理方式是正确的不可变模式
  if (newUpdate.callback_query?.message) {
    // 创建一个全新的 callback_query 对象，只替换其中的 message 属性
    newUpdate.callback_query = {
      ...newUpdate.callback_query,
      message: simplifyMessage(newUpdate.callback_query.message),
    };
  }

  return newUpdate;
};
