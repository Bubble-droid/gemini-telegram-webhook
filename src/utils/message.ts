import { fileHandler } from '@/handlers';
import { logger } from '@/services';
import { bot } from '@/services/apis';
import type { ApiParams, ApiResult, AutoDeleteParams, ChatId, CustomReplyParams } from '@/types';
import type { Part } from '@google/genai';
import type { Message, MessageEntity, Update } from 'grammy/types';
import { deepClone } from './helpers';

type SendOrUpdateOptions = CustomReplyParams &
  AutoDeleteParams &
  Pick<ApiParams<'editMessageText'>, 'parse_mode' | 'reply_markup'> & {
    messageIdToEdit?: number;
  };

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const MsgPTTL = {
  '3m': 3 * MIN,
  '5m': 5 * MIN,
  '10m': 10 * MIN,
  '1d': 1 * DAY,

  sec: (seconds: number): number => seconds * SEC,
  min: (minutes: number): number => minutes * MIN,
  hour: (hours: number): number => hours * HOUR,
  day: (days: number): number => days * DAY,
} as const;

/**
 * 检查消息是否包含文件
 */
export const hasFile = (message?: Message): boolean => {
  return !!(
    (message?.sticker && !message.sticker.is_animated) ??
    message?.animation ??
    message?.document ??
    message?.photo ??
    message?.video ??
    message?.audio ??
    message?.voice
  );
};

export const hasImage = (message?: Message): boolean => {
  const { sticker, photo, document } = message ?? {};
  const isImageSticker = sticker && !sticker.is_animated && !sticker.is_video;
  const isImageDocument = document && document.mime_type?.startsWith('image/') && !document.mime_type.endsWith('/gif');

  return !!(photo ?? isImageSticker ?? isImageDocument);
};

/**
 * 并发处理消息中的媒体文件
 * @param messages 消息数组
 * @param predicate 过滤函数，用于判断消息是否包含需要处理的文件 (如 isContainsImage 或 isContainsFile)
 * @returns Promise<Part[]> Gemini 的 Part 数组
 */
export const handleMediaFiles = async (messages: Message[], predicate: (msg: Message) => boolean): Promise<Part[]> => {
  // 1. 过滤并映射为 Promise 数组
  const mediaPromises = messages.filter(predicate).map(async (msg) => {
    try {
      const fileData = await fileHandler.handle(msg);
      return fileData ? { inlineData: fileData } : null;
    } catch (err) {
      logger.warn('Failed to process media file:', { err, msgId: msg.message_id });
      return null;
    }
  });

  if (mediaPromises.length === 0) {
    return [];
  }

  // 2. 并发执行所有下载/转换任务
  const results = await Promise.all(mediaPromises);

  return results.filter((r) => !!r);
};

export const sendOrUpdate = async (
  chatId: ChatId,
  text: string,
  opts?: SendOrUpdateOptions,
): Promise<number | undefined> => {
  let result: ApiResult<'editMessageText' | 'sendMessage'> | undefined = undefined;
  if (opts?.messageIdToEdit) {
    const { messageIdToEdit, ...rest } = opts;
    result = await bot.editMessageText(chatId, messageIdToEdit, text, rest);
    if (result.ok) return typeof result.data !== 'boolean' ? result.data.message_id : messageIdToEdit;
  }

  result = await bot.sendMessage(chatId, text, opts);

  return result.ok && typeof result.data !== 'boolean' ? result.data.message_id : undefined;
};

const filterEntity = <T extends MessageEntity[]>(entities: T): T => {
  return entities.filter((e) => ['text_mention', 'mention', 'bot_command'].includes(e.type)) as T;
};

/**
 * @description 安全地创建一个简化的 Message 对象副本。
 * @param message - 原始的 Message 对象
 */
const simplifyMessage = <T extends Message>(message: T): T => {
  if (message.entities) message.entities = filterEntity(message.entities);

  if (message.caption_entities) message.caption_entities = filterEntity(message.caption_entities);

  if (message.photo) message.photo = [message.photo[message.photo.length - 1]].filter((p) => !!p);

  if (message.reply_to_message) message.reply_to_message = simplifyMessage(message.reply_to_message);

  if (message.reply_markup?.inline_keyboard) {
    message.reply_markup = {
      inline_keyboard: [message.reply_markup.inline_keyboard[0]].filter((k) => !!k),
    };
  }
  return message;
};

/**
 * @description ：创建一个简化的 Update 对象副本用于日志记录。
 * @param update - 原始的 Update 对象
 */
export const simplifyUpdateInLogger = (update: Update): Update => {
  const updateCopy = deepClone(update);

  if (updateCopy.message) updateCopy.message = simplifyMessage(updateCopy.message);

  if (updateCopy.edited_message) updateCopy.edited_message = simplifyMessage(updateCopy.edited_message);

  if (updateCopy.callback_query?.message) {
    updateCopy.callback_query.message = simplifyMessage(updateCopy.callback_query.message);
  }

  return updateCopy;
};
