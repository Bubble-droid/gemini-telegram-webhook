// src/handlers/message/command.ts

import { BotCommands } from '@/configs';
import { bot, logger } from '@/services';
import type { Message, MessageEntity } from '@/types';

/**
 * 命令解析结果接口
 */
interface CommandParseResult {
  commandName: string;
  cleanText: string; // 剔除命令后的参数文本
}

/**
 * @description 负责处理 Telegram Bot 命令 (/start, /help 等)。
 *              采用无状态单例模式，解析消息并分发给对应的 Command Action。
 */
class CommandHandler {
  /**
   * 解析消息中的命令实体和参数
   */
  private parseCommand(message: Message): CommandParseResult | null {
    const messageText = (message.text || message.caption || '') as string;
    const entities = (message.entities || message.caption_entities || []) as MessageEntity[];

    // 查找类型为 bot_command 的实体
    const commandEntity = entities.find((entity) => entity.type === 'bot_command');

    if (!commandEntity || !messageText) {
      logger.warn('尝试处理命令，但未发现有效的 bot_command 实体或文本', { messageId: message.message_id });
      return null;
    }

    // 提取完整的命令字符串 (例如: "/start" 或 "/start@MyBot")
    const fullCommandText = messageText.substring(commandEntity.offset, commandEntity.offset + commandEntity.length);

    // 解析命令名称 (移除 "/" 和可能存在的 "@BotName")
    // slice(1) 去掉开头的 '/'
    // split('@')[0] 去掉可能存在的 '@BotUsername'
    const commandName = fullCommandText.slice(1).split('@')[0].trim();

    // 获取剔除命令后的纯文本参数
    // 注意：这里简单替换第一次出现的命令字符串，并去除首尾空格
    const cleanText = messageText.replace(fullCommandText, '').trim();

    return { commandName, cleanText };
  }

  /**
   * 处理命令的主入口
   * @param {Message} message - Telegram 消息对象
   */
  public async handle(message: Message): Promise<void> {
    const { message_id: messageId, from, chat } = message;

    // 确保发送者信息存在（虽然在 Message 中通常都有，但类型定义上可能是可选的）
    const userId = from?.id;
    if (!userId) {
      logger.warn('收到匿名或无效来源的命令，忽略执行', { messageId });
      return;
    }

    logger.info('Handling command message...', { chatId: chat.id, messageId, userId });

    // 1. 解析命令
    const parseResult = this.parseCommand(message);
    if (!parseResult) return;

    const { commandName, cleanText } = parseResult;

    // 2. 刷新/设置该用户的指令菜单 (保留原逻辑)

    const botCommands = BotCommands.map((command) => ({
      command: command.name,
      description: command.description,
    }));

    bot.setBotCommands(chat.id, userId, botCommands);

    // 3. 查找对应的命令配置
    const targetCommand = BotCommands.find((cmd) => cmd.name === commandName);

    if (targetCommand) {
      logger.info(`执行命令: /${commandName}`, { cleanText });

      try {
        // 4. 执行命令 Action
        await targetCommand.action(chat.id, userId, messageId, {
          cleanText,
          message,
        });
      } catch (err) {
        logger.error(`执行命令 /${commandName} 时发生错误`, { err, messageId });
        throw err;
      }
    } else {
      logger.info(`未找到命令: /${commandName}`);
    }
  }
}

export const commandHandler: CommandHandler = new CommandHandler();
