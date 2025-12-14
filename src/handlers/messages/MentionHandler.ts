import { BotMessages } from '@/configs';
import { bot, chatContexts, config, logger, questionHandler } from '@/services';
import type { Message, ParseMode, TextQuote } from '@/types';
import { handleMediaFiles, rateLimiter, sendFormattedMessage, taskScheduler } from '@/utils';
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
const hasFile = (message: Message | undefined): boolean => {
  return !!(
    message &&
    (message.sticker ||
      message.animation ||
      message.document ||
      message.photo ||
      message.video ||
      message.audio ||
      message.voice)
  );
};

export const hasImage = (message: Message): boolean => {
  const { sticker, photo, document } = message;
  const isImageSticker = sticker && !sticker.is_animated && !sticker.is_video;
  const isImageDocument = document && document.mime_type?.startsWith('image/') && !document.mime_type.endsWith('/gif');

  return !!(photo || isImageSticker || isImageDocument);
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

  private readonly processingLocks: Set<string> = new Set();

  constructor() {
    this.botName = config.botName;
    this.adminId = config.adminId;
  }

  /**
   * 从 Telegram 消息中提取适用于 Gemini API 的内容部分
   * @private
   */
  private async extractMessageParts(messages: Message[]): Promise<Part[]> {
    const parts: Part[] = [];

    const fileParts = await handleMediaFiles(messages, hasFile);

    parts.push(...fileParts);

    const mentionRegex = new RegExp(`@${this.botName}`, 'gi');

    const combinedText = messages
      .map((msg) =>
        (msg.text || msg.caption || '')
          .replace(mentionRegex, '')
          .replace(/^:ask/gi, '')
          .replace(/^🤖 模型：.*?\n+/g, '')
          .replace(/⚠️ 本 AI[\s\S]*$/m, '')
          .trim(),
      )
      .filter(Boolean)
      .join('\n')
      .trim();

    if (combinedText) {
      parts.push({ text: combinedText });
    }

    // 默认 Prompt
    if (parts.length > 0 && !combinedText) {
      parts.push({ text: 'Analyze these files' });
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
  private async updateFileUploadMessage(messages: Message[], ctx: MentionContext): Promise<void> {
    if (messages.some((m) => hasFile(m) || hasFile(m.reply_to_message))) {
      ctx.initMessageId = await updateOrSendMessage(ctx.chatId, BotMessages.uploading, ctx.initMessageId, {
        replyToMessageId: ctx.userMessageId,
      });
    }
  }

  /**
   * 构建发送给 Gemini 的完整上下文（包括历史记录、引用、当前消息）
   * @private
   */
  private async buildCompleteContents(ctx: MentionContext, groupMessages: Message[]): Promise<Content[]> {
    const { chatId, userId } = ctx;

    // 1. 获取历史记录
    const historyChatContents = chatContexts.get(chatId, userId);
    const completeContents: Content[] = [...historyChatContents];

    const replyToMessage = groupMessages.find((m) => !!m.reply_to_message);

    const textQuote = groupMessages.find((m) => !!m.quote);

    let quoteTextPrefix = '';
    if (textQuote?.quote?.text) {
      quoteTextPrefix = `❝ Quoted: "${textQuote.quote.text}"\n\n`;
    }

    // 4. 处理被回复的消息 (Reply Context)
    if (replyToMessage) {
      const replyToParts = await this.extractMessageParts([replyToMessage]);
      if (replyToParts.length > 0) {
        const replyRole = replyToMessage.from?.username === this.botName ? 'model' : 'user';
        completeContents.push({
          role: replyRole,
          parts: replyToParts,
        });
      }
    }

    // 5. 处理当前消息
    const currentParts = await this.extractMessageParts(groupMessages);

    if (quoteTextPrefix) {
      const textPartIndex = currentParts.findIndex((p) => p.text);
      if (textPartIndex !== -1) {
        currentParts[textPartIndex].text = quoteTextPrefix + currentParts[textPartIndex].text;
      } else {
        currentParts.push({ text: quoteTextPrefix }); // 放在最后或最前均可，Gemini 都能理解
      }
    }

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
    ctx.initMessageId = await updateOrSendMessage(ctx.chatId, BotMessages.thinking, ctx.initMessageId, {
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
    await sendFormattedMessage(ctx.chatId, ctx.initMessageId, ctx.userMessageId, finalText as string);

    completeContents.push(geminiResponse.candidates?.[0]?.content as Content);

    chatContexts.update(ctx.chatId, ctx.userId, completeContents);
  }

  // [新增/修改] 处理消息组入口
  public async handleGroup(messages: Message[]): Promise<void> {
    if (messages.length === 0) return;

    // 1. 找到“触发点”消息，用于确定回复对象和上下文
    const triggerMsg =
      messages.find((m) => {
        const text = m.text || m.caption || '';
        return text.includes(`@${this.botName}`) || text.startsWith(':ask') || !!text;
      }) || messages[0];

    const { chat, from, message_id } = triggerMsg;

    if (!from) return;

    // 2. 生成锁 Key
    const lockKey = `${chat.id}:${from.id}`;
    // 3. 检查锁：如果已存在，直接忽略本次请求
    if (this.processingLocks.has(lockKey)) {
      logger.warn(`[MentionHandler] Ignored concurrent request from ${lockKey}`);
      const text = '💡 你已经有一个请求在处理中，请等待处理完成后再试...';
      taskScheduler.sendTempMessage(chat.id, text, 3 * 60 * 1000, {
        replyToMessageId: message_id,
      });
      return;
    }

    this.processingLocks.add(lockKey);

    const ctx: MentionContext = {
      chatId: chat.id,
      userId: from.id,
      userMessageId: message_id,
      message: triggerMsg, // 上下文主要基于这条
      replyToMessage: triggerMsg.reply_to_message,
      quote: triggerMsg.quote,
      initMessageId: undefined,
    };

    try {
      // 2. 速率限制检查
      if (await this.handleRateLimiting(ctx)) return;

      await this.updateFileUploadMessage(messages, ctx);

      // 3. 构建内容时，传入整个 messages 数组
      const completeContents = await this.buildCompleteContents(ctx, messages);

      if (completeContents[completeContents.length - 1].role === 'model') {
        const text = '未能从消息中提取到有效内容，请检查消息格式。';
        const messageId = await updateOrSendMessage(ctx.chatId, text, ctx.initMessageId, {
          replyToMessageId: ctx.userMessageId,
        });
        taskScheduler.deleteMessage(ctx.chatId, messageId, 3 * 60 * 1000);
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
    } finally {
      this.processingLocks.delete(lockKey);
    }
  }

  /**
   * 处理消息的主入口
   * @public
   */
  public async handle(message: Message): Promise<void> {
    return await this.handleGroup([message]);
  }
}

export const mentionHandler: MentionHandler = new MentionHandler();
