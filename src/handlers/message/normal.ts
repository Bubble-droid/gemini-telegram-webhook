// src/handlers/message/normal.ts

import { Log, config } from '@/services';
import type { Message } from '@/types/telegram';
import { BotCommands } from '@/configs';
import { handleMention } from '@/handlers/message';

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
  const { message_id: messageId, from, chat, reply_to_message } = message;
  Log.info('Handling normal message.', { chatId: chat.id, messageId });
  if (message.text?.startsWith(':') || message.caption?.startsWith(':')) {
    const messageText = message.text || message.caption || '';
    const [commandAlias, ...cleanText] = messageText.replace(':', '').split(' ');
    if (commandAlias === 'ask') {
      return await handleMention(message);
    }
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
  if (!reply_to_message) return;
  if (!reply_to_message.from || reply_to_message.from.username !== botName) return;
  return await handleMention(message);
};

export { handleNormal };
