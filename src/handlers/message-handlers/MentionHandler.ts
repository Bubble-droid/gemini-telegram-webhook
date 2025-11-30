// src/handlers/message/mention.ts

import { fileHandler } from '@/handlers';
import { bot, chatContexts, config, logger, questionHandler } from '@/services';
import type { Message, ParseMode, TextQuote } from '@/types';
import { rateLimiter, sendFormattedMessage, taskScheduler } from '@/utils';
import type { Content, GenerateContentResponse, Part } from '@google/genai';

/**
 * 提及处理上下文接口
 * 保存一次处理流程中需要流转的所有状态
 */
interface MentionContext {
  chatId: number;
  userId: number;
  userMessageId: number;
  message: Message;
  replyToMessage?: Message;
  quote?: TextQuote;
  initMessageId?: number; // 这是一个可变状态，随着流程推进（如发送“思考中”）而更新
}

/**
 * 检查消息是否包含文件
 */
const isContainsFile = (message: Message | undefined): boolean => {
  return !!(message && (message.document || message.photo || message.video || message.audio || message.voice));
};

/**
 * 统一的消息发送或更新工具
 */
export const updateOrSendMessage = async (
  chatId: number | string,
  msgText: string,
  srcMsgId: number | undefined,
  options?: {
    replyToMessageId?: number;
    parseMode?: ParseMode;
  },
): Promise<number> => {
  let result;
  if (srcMsgId) {
    result = await bot.editMessageText(chatId, srcMsgId, msgText, options);
    if (result.ok) return srcMsgId;
  }
  // 如果没有 srcMsgId 或者编辑失败，发送新消息
  result = await bot.sendMessage(chatId, msgText, options);
  return result.ok ? result.messageId : (srcMsgId as number);
};

/**
 * @class MentionHandler
 * @description 处理提及 Bot (@BotName) 或回复 Bot 消息的逻辑。
 *              采用无状态单例模式，所有状态通过 Context 传递。
 */
class MentionHandler {
  private botName: string;
  private adminId: number;

  constructor() {
    this.botName = config.botName;
    this.adminId = config.adminId;
  }

  /**
   * 从 Telegram 消息中提取适用于 Gemini API 的内容部分
   * @private
   */
  private async extractMessageParts(message: Message): Promise<Part[]> {
    const parts: Part[] = [];

    let messageText = message.text || message.caption || '';

    // 清理文本：移除 @botName, :ask 标记
    messageText = messageText
      .replace(new RegExp(`(@${this.botName})`, 'gi'), '')
      .replace(/(:ask)/gi, '')
      .trim();

    // 清理机器人之前的回复格式（防止模型自循环）
    if (messageText.includes('🤖 模型：') || messageText.includes('✨ 本次任务')) {
      messageText = messageText
        .replace(/^🤖 模型：.*?\n+/g, '')
        .replace(/✨ API 调用[\s\S]*$/m, '')
        .trim();
    }

    // 处理文件
    if (isContainsFile(message)) {
      const fileData = await fileHandler.handle(message);
      if (fileData) {
        parts.push({ inlineData: fileData });
      }

      // 默认提示词
      if (!messageText) {
        if (message.document) messageText = '分析这个文件';
        else if (message.photo) messageText = '分析这张图片';
        else if (message.video) messageText = '分析这个视频';
      }
    }

    if (messageText) {
      parts.push({ text: messageText });
    }

    return parts;
  }

  /**
   * 检查并处理速率限制
   * @private
   * @returns {Promise<boolean>} 如果被限制返回 true
   */
  private async handleRateLimiting(ctx: MentionContext): Promise<boolean> {
    const { chatId, userId, userMessageId } = ctx;

    const checkResult = rateLimiter.check(chatId);

    if (!checkResult.canProceed && userId !== this.adminId) {
      logger.warn(`Rate limit exceeded for chat ${chatId}. Retry after ${checkResult.retryAfterSeconds} seconds.`);

      const newId = await updateOrSendMessage(
        chatId,
        `超出速率限制，请等待 ${checkResult.retryAfterSeconds} 秒后重试。`,
        ctx.initMessageId,
        { replyToMessageId: userMessageId },
      );

      // 更新上下文中的 ID
      ctx.initMessageId = newId;

      taskScheduler.deleteMessage(chatId, newId, checkResult.retryAfterSeconds * 1_000);
      return true;
    }
    return false;
  }

  /**
   * 发送“文件上传中”提示
   * @private
   */
  private async updateFileUploadMessage(ctx: MentionContext): Promise<void> {
    if (isContainsFile(ctx.message) || isContainsFile(ctx.replyToMessage)) {
      ctx.initMessageId = await updateOrSendMessage(ctx.chatId, '📄 File uploading...', ctx.initMessageId, {
        replyToMessageId: ctx.userMessageId,
      });
    }
  }

  /**
   * 构建发送给 Gemini 的完整上下文（包括历史记录、引用、当前消息）
   * @private
   */
  private async buildCompleteContents(ctx: MentionContext): Promise<Content[]> {
    const { chatId, userId, message, quote, replyToMessage } = ctx;

    // 1. 获取历史记录
    const historyChatContents = chatContexts.get(chatId, userId);
    const completeContents: Content[] = [...historyChatContents];

    // 2. 准备当前消息副本
    const currentMessageCopy: Message = { ...message };

    // 3. 处理引用回复 (Reply Quote)
    if (quote?.text) {
      const quotedContents = `${quote.text.replace(/^/gm, '> ')}\n\n${message.text || message.caption || ''}`;
      currentMessageCopy.text = quotedContents;
    }

    // 4. 处理被回复的消息 (Reply Context)
    if (replyToMessage) {
      const replyToParts = await this.extractMessageParts(replyToMessage);
      if (replyToParts.length > 0) {
        const replyRole = replyToMessage.from?.username === this.botName ? 'model' : 'user';
        completeContents.push({
          role: replyRole,
          parts: replyToParts,
        });
      }
    }

    // 5. 处理当前消息
    const currentParts = await this.extractMessageParts(currentMessageCopy);
    if (currentParts.length > 0) {
      completeContents.push({
        role: 'user',
        parts: currentParts,
      });
    }

    return completeContents;
  }

  /**
   * 发送“思考中”提示
   * @private
   */
  private async updateThinkingMessage(ctx: MentionContext): Promise<void> {
    ctx.initMessageId = await updateOrSendMessage(ctx.chatId, '✨ Thinking...', ctx.initMessageId, {
      replyToMessageId: ctx.userMessageId,
    });
  }

  /**
   * 处理 API 响应结果
   * @private
   */
  private async processGeminiResponse(
    ctx: MentionContext,
    geminiResponse: GenerateContentResponse,
    completeContents: Content[],
  ): Promise<void> {
    const finalText = geminiResponse.text;

    // 发送最终格式化消息
    const finalReplyResult = await sendFormattedMessage(
      ctx.chatId,
      ctx.initMessageId,
      ctx.userMessageId,
      finalText as string,
    );

    if (!finalReplyResult.ok) {
      throw finalReplyResult.error;
    }

    completeContents.push(geminiResponse.candidates?.[0]?.content as Content);

    chatContexts.update(ctx.chatId, ctx.userId, completeContents);
  }

  /**
   * 处理消息的主入口
   * @public
   */
  public async handle(message: Message): Promise<void> {
    const { chat, from, message_id, reply_to_message, quote } = message;

    // 1. 构建请求上下文 (Context)
    const ctx: MentionContext = {
      chatId: chat.id,
      userId: from?.id as number,
      userMessageId: message_id,
      message,
      replyToMessage: reply_to_message,
      quote,
      initMessageId: undefined,
    };

    // 2. 速率限制检查
    if (await this.handleRateLimiting(ctx)) return;

    try {
      // 3. 上传文件提示
      await this.updateFileUploadMessage(ctx);

      // 4. 构建对话内容
      const completeContents = await this.buildCompleteContents(ctx);

      if (completeContents.length === 0) {
        const text = '未能从消息中提取到有效内容，请检查消息格式。';
        ctx.initMessageId = await updateOrSendMessage(ctx.chatId, text, ctx.initMessageId, {
          replyToMessageId: ctx.userMessageId,
        });
        taskScheduler.deleteMessage(ctx.chatId, ctx.initMessageId, 3 * 60 * 1000);
        return;
      }

      // 5. 发送思考中状态
      await this.updateThinkingMessage(ctx);

      const geminiResponse = await questionHandler.handle(
        {
          chatId: ctx.chatId,
          userMessageId: ctx.userMessageId,
          statusMessageId: ctx.initMessageId as number,
        },
        completeContents,
      );

      // 7. 处理响应
      await this.processGeminiResponse(ctx, geminiResponse, completeContents);
    } catch (apiError) {
      logger.error('Error during Gemini API call or response processing.', {
        err: apiError,
        chatId: ctx.chatId,
        messageId: ctx.userMessageId,
      });

      // 错误处理：根据情况删除或保留错误提示
      if (ctx.initMessageId) {
        await bot.deleteMessage(ctx.chatId, ctx.initMessageId);
      }
      // 抛出错误供上层（UpdateHandler）捕获并通知管理员/用户
      throw apiError;
    }
  }
}

export const mentionHandler: MentionHandler = new MentionHandler();
