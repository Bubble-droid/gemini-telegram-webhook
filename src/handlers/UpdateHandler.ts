import { callbackQueryHandler } from '@/handlers';
import { commandHandler, mentionHandler, normalMessageHandler } from '@/handlers/messages';
import { bot, config, logger } from '@/services';
import type * as Bot from '@/types/telegram';
import { deepClone, messageCollector, sendErrorNotification, shortenString, sleep, taskScheduler } from '@/utils';
import { AppError } from '@/utils/errors';
import { escaper } from '@/utils/formatters';

/**
 * @description 安全地创建一个简化的 Message 对象副本。
 * @param message - 原始的 Message 对象
 */
const simplifyMessage = (message: Bot.Message | undefined): Bot.Message | undefined => {
  if (!message) return undefined;

  const filterEntity = (entities: Bot.MessageEntity[] | undefined): Bot.MessageEntity[] | undefined =>
    entities?.filter((e) => ['text_mention', 'mention', 'bot_command'].includes(e.type));

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

/**
 * @description 核心更新处理器，负责接收 Telegram Update，进行权限验证、路由分发和错误处理。
 */
class UpdateHandler {
  private botName: string;
  private allowGroups: number[];

  constructor() {
    this.botName = config.botName;
    this.allowGroups = config.allowGroups;

    // 注册收集器的回调：当收集完毕后，执行此逻辑
    messageCollector.registerCallback(async (messages) => {
      try {
        await this.dispatchBatch(messages);
      } catch (err) {
        const anchorMsg = messages.find((m) => m.text || m.caption) || messages[0];
        this.handleError(err, anchorMsg);
      }
    });
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
   * @description 检查是否在消息中提到了机器人。
   * @private
   */
  private isBotMentioned(text: string, entities: Bot.MessageEntity[]): boolean {
    return entities.some((entity) => {
      const isMentionType = entity.type === 'mention' || entity.type === 'text_mention';
      if (isMentionType) {
        const mentionedText = text.substring(entity.offset, entity.offset + entity.length);
        return mentionedText === `@${this.botName}`;
      }
      return false;
    });
  }

  /**
   * @description 检查是否是显式指向该机器人的命令。
   * @private
   */
  private isBotCommand(text: string, entities: Bot.MessageEntity[]): boolean {
    return entities.some((entity) => {
      const isCommandType = entity.type === 'bot_command';
      if (isCommandType) {
        const commandText = text.substring(entity.offset, entity.offset + entity.length);
        const atIndex = commandText.indexOf('@');
        return atIndex !== -1 && commandText.slice(atIndex + 1) === this.botName;
      }
      return false;
    });
  }

  /**
   * @description 统一错误处理逻辑。
   * @private
   */
  private handleError(err: unknown, msg: Bot.Message, updateId?: number): void {
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

  /**
   * 接收 [Text, Doc1, Doc2] 混合数组
   */
  private async dispatchBatch(messages: Bot.Message[]): Promise<void> {
    if (messages.length === 0) return;

    for (const msg of messages) {
      const text = msg.text || msg.caption || '';
      const entities = msg.entities || msg.caption_entities || [];

      if (this.isBotMentioned(text, entities)) {
        await mentionHandler.handleGroup(messages);
        return;
      }

      if (this.isBotCommand(text, entities)) {
        await commandHandler.handle(msg);
        return;
      }
    }

    // 既没有 Mention 也没有 Command -> 普通消息 (OCR / ChitChat)
    await normalMessageHandler.handleGroup(messages);
  }

  /**
   * @description 处理接收到的 Telegram 更新对象的主入口。
   * @param update - Telegram 更新对象。
   */
  public async handle(update: Bot.Update): Promise<void> {
    const { update_id, message, callback_query } = update;

    logger.debug('Handling Telegram update', { update: simplifyUpdateInLogger(update) });

    if (!message && !callback_query) return;

    const msg = message || callback_query?.message;

    if (!msg) {
      logger.warn('No message or callback_query message found in update', { updateId: update_id });
      return;
    }

    if (!this.validateChatType(msg)) return;

    if (!(await this.validateGroupPermission(msg))) return;

    try {
      if (callback_query?.data) {
        await callbackQueryHandler.handle(callback_query);
        return;
      }

      if (msg) {
        messageCollector.addAndSchedule(msg);
      }
    } catch (err) {
      this.handleError(err, msg, update_id);
    }
  }
}

export const updateHandler = new UpdateHandler();
