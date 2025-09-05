// src/handlers/message/normal.ts

import { Log, config } from '@/services';
import type { Message } from '@/types/telegram';
import { handleMention } from './mention';
import { BotCommands } from '@/configs';

/**
 * @function handleNormal
 * @description 处理接收到的 Telegram 普通消息（非提及、非命令）。
 *              此函数主要负责检查消息是否是对 Bot 消息的回复，并对回复内容进行清理后，
 *              转交给提及消息处理器处理。
 * @param {Message} message - Telegram 消息对象。
 * @returns {Promise<void>}
 */
const handleNormal = async (message: Message): Promise<void> => {
  const { botName } = config.load();
  if (message.text?.startsWith(':') || message.caption?.startsWith(':')) {
    const { message_id: messageId, text, caption, from, chat } = message;
    const messageText = text || caption || '';
    const [commandAlias, ...cleanText] = messageText.replace(':', '').split(' ');
    const commandAction = BotCommands.find(
      (command) => command.name === commandAlias || command.name === `script_${commandAlias}` || command.name === `gen_${commandAlias}`,
    );
    if (commandAction) {
      Log.info('Handling commands message...', { chatId: chat.id, messageId });
      return await commandAction.action({
        chatId: chat.id,
        userId: from?.id as number,
        messageId,
        cleanText: cleanText.join(' ').trim(),
        message,
      });
    }
  }
  if (!message.reply_to_message) return;
  const { chat, message_id, reply_to_message } = message;
  if (!reply_to_message.from || reply_to_message.from.username !== botName) return;
  Log.info('Handling normal message.', { chatId: chat.id, messageId: message_id });
  let cleanMessage: Message = { ...message };
  if (reply_to_message.text) {
    if (reply_to_message.text.includes('🤖 模型：') || reply_to_message.text.includes('✨ 本次任务')) {
      const cleanMessageTexts = reply_to_message.text.replace(/^🤖 模型：.*?\n+/g, '').replace(/✨ 本次任务[\s\S]*$/m, '');
      cleanMessage = { ...message, reply_to_message: { ...reply_to_message, text: cleanMessageTexts } };
    }
  }
  return await handleMention(cleanMessage);
};

export { handleNormal };
