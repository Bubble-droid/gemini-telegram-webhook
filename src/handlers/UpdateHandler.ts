// src/handlers/update.ts

import { commandHandler, mentionHandler, normalMessageHandler } from '@/handlers/message-handlers';
import { AppError, bot, config, logger } from '@/services';
import type * as Bot from '@/types/telegram';
import { deepClone, sendErrorNotification, shortenString, sleep, taskScheduler } from '@/utils';
import { escaper } from '@/utils/formatters';
import { callbackQueryHandler } from './CallbackQueryHandler';

/**
 * @description 核心更新处理器，负责接收 Telegram Update，进行权限验证、路由分发和错误处理。
 */
class UpdateHandler {
  private botName: string;
  private allowGroups: number[];

  constructor() {
    this.botName = config.botName;
    this.allowGroups = config.allowGroups;
  }

  /**
   * @description 处理接收到的 Telegram 更新对象的主入口。
   * @param update - Telegram 更新对象。
   */
  public async handle(update: Bot.Update): Promise<void> {
    const { update_id, message, callback_query } = update;

    // 1. 忽略贴纸消息
    if (message?.sticker) return;

    logger.info('Handling Telegram update', { update: simplifyUpdateInLogger(update) });

    // 2. 确保存在有效的消息体或回调
    if (!message && !callback_query) return;

    // 3. 提取核心消息对象 (Message)
    const msg = message || callback_query?.message;
    if (!msg) {
      logger.warn('No message or callback_query message found in update', { updateId: update_id });
      return;
    }

    try {
      // 4. 验证聊天类型 (私聊/群组)
      if (!this.validateChatType(msg)) return;

      // 5. 验证群组权限
      if (!(await this.validateGroupPermission(msg))) return;

      // 6. 路由分发处理
      await this.dispatch(msg, callback_query);
    } catch (err: unknown) {
      // 7. 统一错误处理
      this.handleError(err, msg, update_id);
    }
  }

  /**
   * @description 验证聊天类型是否为支持的群组类型。
   * 如果不支持，发送提示并计划删除。
   * @private
   */
  private validateChatType(msg: Bot.Message): boolean {
    const { chat, message_id } = msg;
    if (['group', 'supergroup'].includes(chat.type)) {
      return true;
    }

    taskScheduler.sendTempMessage(chat.id, '不支持私聊与频道，请在群组内使用此机器人。', 3 * 60_000, {
      relatedMessageIds: [message_id],
    });
    return false;
  }

  /**
   * @description 验证群组是否在允许列表中。
   * 如果未授权，发送提示并退群。
   * @private
   */
  private async validateGroupPermission(msg: Bot.Message): Promise<boolean> {
    const { chat } = msg;

    if (this.allowGroups.includes(chat.id)) {
      return true;
    }

    // 处理未授权群组
    await bot.sendMessage(chat.id, '群组未授权！');
    await sleep(3000);
    bot.leaveChat(chat.id);
    return false;
  }

  /**
   * @description 核心路由逻辑：根据消息内容决定调用哪个处理器。
   * @private
   */
  private async dispatch(msg: Bot.Message, callbackQuery?: Bot.CallbackQuery): Promise<void> {
    // 情况 A: 回调查询 (Callback Query)
    if (callbackQuery?.data) {
      return await callbackQueryHandler.handle(callbackQuery);
    }

    const messageText = msg.text || msg.caption || '';
    const entities = msg.entities || msg.caption_entities || [];

    // 情况 B: 提及机器人 (@BotName)
    if (entities.length > 0 && this.isBotMentioned(messageText, entities)) {
      return await mentionHandler.handle(msg);
    }

    // 情况 C: 针对机器人的显式命令 (/cmd@BotName)
    if (entities.length > 0 && this.isBotCommand(messageText, entities)) {
      return await commandHandler.handle(msg);
    }

    // 情况 D: 普通消息
    return await normalMessageHandler.handle(msg);
  }

  /**
   * @description 检查是否在消息中提到了机器人。
   * @private
   */
  private isBotMentioned(text: string, entities: Bot.MessageEntity[]): boolean {
    for (const entity of entities) {
      if (entity.type === 'mention' || entity.type === 'text_mention') {
        const mentionedText = text.substring(entity.offset, entity.offset + entity.length);
        if (mentionedText === `@${this.botName}`) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * @description 检查是否是显式指向该机器人的命令。
   * @private
   */
  private isBotCommand(text: string, entities: Bot.MessageEntity[]): boolean {
    for (const entity of entities) {
      if (entity.type === 'bot_command') {
        const commandText = text.substring(entity.offset, entity.offset + entity.length);
        const atIndex = commandText.indexOf('@');
        // 只有当命令包含 @ 且后缀完全匹配 botName 时才算作显式命令
        if (atIndex !== -1 && commandText.slice(atIndex + 1) === this.botName) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * @description 统一错误处理逻辑。
   * @private
   */
  private handleError(err: unknown, msg: Bot.Message, updateId: number): void {
    const { chat, message_id } = msg;
    const errorMessage = err instanceof AppError ? err.message : String(err);

    logger.error('Error while handling update', { err, updateId });

    sendErrorNotification(
      err,
      `Error while handling update ${JSON.stringify({ chatId: chat.id, messageId: message_id })}`,
    );

    const shorten = `<blockquote expandable>${escaper.html(shortenString(`❌ ${errorMessage}`))}</blockquote>`;

    taskScheduler.sendTempMessage(chat.id, shorten, 3 * 60_000, {
      replyToMessageId: message_id,
      parseMode: 'HTML',
    });
  }
}

// 导出单例实例，方便调用
export const updateHandler: UpdateHandler = new UpdateHandler();

/**
 * @description 安全地创建一个简化的 Message 对象副本。
 * @param message - 原始的 Message 对象
 */
const simplifyMessage = (message: Bot.Message | undefined): Bot.Message | undefined => {
  if (!message) return undefined;

  const truncate = (text?: string): string | undefined =>
    text ? (text.length > 20 ? `${text.slice(0, 20)}...` : text) : undefined;

  const filterEntity = (entities: Bot.MessageEntity[] | undefined): Bot.MessageEntity[] | undefined =>
    entities?.filter((e) => ['text_mention', 'mention', 'bot_command'].includes(e.type));

  message.text = truncate(message.text);
  message.caption = truncate(message.caption);
  message.entities = filterEntity(message.entities);
  message.caption_entities = filterEntity(message.caption_entities);
  message.photo = message.photo ? [message.photo[message.photo.length - 1]] : undefined;
  message.reply_to_message = simplifyMessage(message.reply_to_message);
  message.reply_markup = message.reply_markup?.inline_keyboard
    ? { inline_keyboard: [message.reply_markup.inline_keyboard[0]] }
    : undefined;

  return message;
};

/**
 * @description ：创建一个简化的 Update 对象副本用于日志记录。
 * @param update - 原始的 Update 对象
 */
const simplifyUpdateInLogger = (update: Bot.Update): Bot.Update => {
  const updateCopy = deepClone(update);

  if (updateCopy.message) {
    updateCopy.message = simplifyMessage(updateCopy.message);
  }

  if (updateCopy.edited_message) {
    updateCopy.edited_message = simplifyMessage(updateCopy.edited_message);
  }

  if (updateCopy.callback_query?.message) {
    updateCopy.callback_query.message = simplifyMessage(updateCopy.callback_query.message);
  }

  return updateCopy;
};
