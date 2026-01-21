import { BotMessages } from '@/configs';
import { mentionHandler, NormalMessageHandler, processCommand } from '@/handlers/messages';
import { config, logger } from '@/services';
import { bot } from '@/services/apis';
import { MessageCollector, MsgPTTL, sendErrorNotification, shortenString, simplifyUpdateInLogger } from '@/utils';
import { AppError } from '@/utils/errors';
import { Escaper } from '@/utils/markdown';
import { ResponseContext } from '@/utils/ResponseContext';
import type { Message, Update } from 'grammy/types';
import { handleCallbackQuery } from './CallbackQueryHandler';

/**
 * 核心更新处理器，负责接收 Telegram Update，进行权限验证、路由分发和错误处理。
 */
export class UpdateHandler {
  private readonly allowGroups: number[] = config.allowGroups;
  private messageCollector: MessageCollector;
  private normalMessageHandler: NormalMessageHandler;

  constructor() {
    this.messageCollector = new MessageCollector();
    this.normalMessageHandler = new NormalMessageHandler();
    this.init();
  }

  public init(): void {
    this.messageCollector.registerCallback(async (messages) => {
      try {
        await this.dispatchBatch(messages);
      } catch (err) {
        const anchorMsg = messages.at(-1);
        if (anchorMsg) this.handleError(err, anchorMsg);
      }
    });

    logger.info('[UpdateHandler] initialized');
  }

  public async handle(update: Update) {
    const { message, callback_query } = update;
    logger.debug('Received webhook update:', { update: simplifyUpdateInLogger(update) });
    if (!message && !callback_query) return;
    if (callback_query?.message) {
      const callbackCtx = new ResponseContext([callback_query.message], callback_query);
      await handleCallbackQuery(callbackCtx);
    } else if (message) {
      if (!this.validateChatType(message)) return;

      if (!this.validateGroupPermission(message)) return;

      this.messageCollector.append(message);
    }
  }

  /**
   * @description 验证聊天类型是否为支持的群组类型。
   * 如果不支持，发送提示并计划删除。
   */
  private validateChatType(msg: Message): boolean {
    const { chat } = msg;
    if (['group', 'supergroup'].includes(chat.type)) {
      return true;
    }

    void bot.sendMessage(chat.id, BotMessages.unsupportedChatType, {
      deleteAfterMs: MsgPTTL['3m'],
    });

    return false;
  }

  /**
   * @description 验证群组是否在允许列表中。
   * 如果未授权，发送提示并退群。
   */
  private validateGroupPermission(msg: Message): boolean {
    const { chat } = msg;

    if (this.allowGroups.includes(chat.id)) {
      return true;
    }

    void bot.sendMessage(chat.id, BotMessages.unauthorizedGroup);
    void bot.leaveChat(chat.id);
    return false;
  }

  /**
   * @description 统一错误处理逻辑。
   */
  private handleError(err: unknown, msg: Message, updateId?: number): void {
    const { chat, message_id } = msg;
    const errorMessage = err instanceof AppError ? err.message : String(err);

    logger.error('Error while handling update', { err, updateId });

    sendErrorNotification(
      err,
      `Error while handling update ${JSON.stringify({ chatId: chat.id, messageId: message_id })}`,
    );

    const shorten = `❌ 发生错误，请稍后再试\n<blockquote expandable>${Escaper.html(shortenString(errorMessage))}</blockquote>`;

    void bot.sendMessage(chat.id, shorten, {
      replyToMessageId: message_id,
      parse_mode: 'HTML',
      deleteAfterMs: MsgPTTL['3m'],
    });
  }

  /**
   * 接收 [Text, Doc1, Doc2] 混合数组
   */
  private async dispatchBatch(messages: Message[]): Promise<void> {
    if (messages.length === 0) return;

    const ctx = new ResponseContext(messages);

    if (ctx.checkBotMentioned()) {
      await mentionHandler.handle(ctx);
      return;
    }

    const commandMsg = ctx.checkBotCommand();

    if (commandMsg) {
      await processCommand(commandMsg, ctx);
      return;
    }

    await this.normalMessageHandler.handle(ctx);
  }
}
