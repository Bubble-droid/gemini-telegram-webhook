import type { Message, MessageEntity, Update } from 'grammy/types';
import { deepClone } from './helpers.js';

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

const filterEntity = <T extends MessageEntity[]>(entities: T): T => {
  return entities.filter((e) => ['text_mention', 'mention', 'bot_command'].includes(e.type)) as T;
};

/**
 * @description 安全地创建一个简化的 Message 对象副本。
 * @param message - 原始的 Message 对象
 */
export const simplifyMessage = <T extends Message>(message: T): T => {
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
export const simplifyUpdate = (update: Update): Update => {
  const updateCopy = deepClone(update);

  if (updateCopy.message) updateCopy.message = simplifyMessage(updateCopy.message);

  if (updateCopy.edited_message) updateCopy.edited_message = simplifyMessage(updateCopy.edited_message);

  if (updateCopy.callback_query?.message) {
    updateCopy.callback_query.message = simplifyMessage(updateCopy.callback_query.message);
  }

  return updateCopy;
};
