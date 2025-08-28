// src/handlers/message/command.ts

import { Log, TelegramBot } from '@/services';
import type { Message, MessageEntity } from '@/types';
import { botCommands } from '@/configs';

/**
 * @function handleCommand
 * @description 处理接收到的 Telegram Bot 命令。
 *              根据消息中的命令实体，查找并执行相应的命令处理函数。
 * @param {Message} message - Telegram Message 对象 (包含 bot_command entity)。
 * @returns {Promise<void>}
 */
const handleCommand = async (message: Message): Promise<void> => {
  const { message_id: messageId, from, chat } = message;
  Log.info('Handling commands message...', { chatId: chat.id, messageId });
  const messageText = (message.text || message.caption) as string;
  const messageEntities = (message.entities || message.caption_entities) as MessageEntity[];
  const commandEntity = messageEntities.find((entity) => entity.type === 'bot_command') as MessageEntity;
  const fullCommandText = messageText.substring(commandEntity.offset, commandEntity.offset + commandEntity.length);
  void TelegramBot.setBotCommands(chat.id, from?.id as number);
  const commandName = fullCommandText.slice(1).split('@')[0].trim();
  const targetCommand = botCommands.find((cmd) => cmd.name === commandName);
  if (targetCommand) {
    await targetCommand.action({
      chatId: chat.id,
      messageId,
      userId: from?.id as number,
      message,
    });
  }
};

export { handleCommand };
