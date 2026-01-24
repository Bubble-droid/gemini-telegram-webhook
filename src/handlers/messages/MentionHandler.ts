import { BotMessages } from '@/configs';
import { chatContext, logger, processQuestion } from '@/services';
import { bot } from '@/services/apis';
import { CONFIG } from '@/services/ConfigLoader';
import type { ResponseContext } from '@/utils';
import { handleMediaFiles, hasFile, MsgPTTL, rateLimiter, sendFormattedMessage } from '@/utils';
import type { Content, GenerateContentResponse, Part } from '@google/genai';
import type { Message } from 'grammy/types';

/**
 * @class MentionHandler
 * @description 处理提及 Bot (@BotName) 或回复 Bot 消息的逻辑。
 *              采用无状态单例模式，所有状态通过 Context 传递。
 */
class MentionHandler {
  private readonly botName = CONFIG.TELEGRAM_BOT_USERNAME;
  private readonly ownerId = CONFIG.TELEGRAM_BOT_OWNER_ID;
  private readonly processingLocks = new Set<string>();

  // 处理消息组入口
  public async handle(ctx: ResponseContext): Promise<void> {
    logger.debug('Received mention', {
      chatId: ctx.chat.id,
      messageId: ctx.primaryMessage.message_id,
      userId: ctx.user.id,
    });

    if (!this.checkProcessingLocks(ctx)) return;

    if (!this.checkRateLimiting(ctx)) return;

    try {
      await this.checkFile(ctx);

      const completeContents = await this.buildCompleteContents(ctx);

      if (!this.checkContents(completeContents, ctx)) return;

      await ctx.reply(BotMessages.thinking);

      const geminiResponse = await processQuestion(completeContents, ctx);

      await this.processGeminiResponse(ctx, geminiResponse, completeContents);
    } catch (apiError) {
      logger.error('Error during Gemini API call or response processing.', {
        err: apiError,
        chatId: ctx.chat.id,
        messageId: ctx.primaryMessage.message_id,
      });

      if (ctx.lastMessageId) void bot.deleteMessage(ctx.chat.id, ctx.lastMessageId);

      throw apiError;
    } finally {
      this.processingLocks.delete(this.generateLockKey(ctx));
    }
  }

  private generateLockKey(ctx: ResponseContext): string {
    return `${ctx.chat.id}:${ctx.user.id}`;
  }

  private checkProcessingLocks(ctx: ResponseContext): boolean {
    const lockKey = this.generateLockKey(ctx);
    if (!this.processingLocks.has(lockKey)) {
      this.processingLocks.add(lockKey);
      return true;
    }

    logger.warn(`[MentionHandler] Ignored concurrent request from ${lockKey}`);
    void ctx.send(BotMessages.pendingRequest, {
      opts: { deleteAfterMs: MsgPTTL['3m'] },
      isReply: true,
    });
    return false;
  }

  /**
   * 检查并处理速率限制
   * @returns 如果被限制返回 true
   */
  private checkRateLimiting(ctx: ResponseContext): boolean {
    const checkResult = rateLimiter.check(ctx.chat.id);

    if (checkResult.canProceed || ctx.user.id === this.ownerId) return true;

    logger.warn(`Rate limit exceeded for chat ${ctx.chat.id}. Retry after ${checkResult.retryAfterSeconds} seconds.`);

    void ctx.send(BotMessages.getRateLimiting(checkResult.retryAfterSeconds), {
      opts: {
        deleteAfterMs: MsgPTTL.sec(checkResult.retryAfterSeconds),
      },
      isReply: true,
    });

    return false;
  }

  /**
   * 发送“文件上传中”提示
   * @private
   */
  private async checkFile(ctx: ResponseContext): Promise<void> {
    if (!ctx.hasValidFile) return;
    await ctx.send(BotMessages.uploading, { isReply: true });
  }

  private checkContents(contents: Content[], ctx: ResponseContext): boolean {
    if (contents.at(-1)?.role !== 'model') return true;
    logger.warn(`Invalid contents ignored.`);
    void ctx.reply(BotMessages.invalidContents, {
      deleteAfterMs: MsgPTTL['3m'],
    });

    return false;
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
        (msg.text ?? msg.caption)
          ?.replace(mentionRegex, '')
          .replace(/^:ask/gi, '')
          .replace(/^🤖 模型：.*?\n+/g, '')
          .replace(/⚠️ 本 AI[\s\S]*$/m, '')
          .trim(),
      )
      .filter(Boolean)
      .join('\n')
      .trim();

    if (combinedText.length > 0) {
      parts.push({ text: combinedText });
    }

    if (parts.length > 0 && combinedText.length === 0) {
      parts.push({ text: 'Analyze these files' });
    }

    return parts;
  }

  /**
   * 构建发送给 Gemini 的完整上下文（包括历史记录、引用、当前消息）
   * @private
   */
  private async buildCompleteContents(ctx: ResponseContext): Promise<Content[]> {
    const historyChatContents: Content[] = [...chatContext.get(ctx.chat.id, ctx.user.id)];

    const replyToMessage = ctx.messages.find((m) => m.reply_to_message);

    const textQuote = ctx.messages.find((m) => m.quote);

    const quoteTextPrefix = textQuote?.quote?.text && `❝ Quoted: "${textQuote.quote.text}"\n\n`;

    // 4. 处理被回复的消息 (Reply Context)
    if (replyToMessage?.reply_to_message) {
      const replyToParts = await this.extractMessageParts([replyToMessage.reply_to_message]);
      if (replyToParts.length > 0) {
        const replyRole = replyToMessage.reply_to_message.from?.username === this.botName ? 'model' : 'user';
        historyChatContents.push({
          role: replyRole,
          parts: replyToParts,
        });
      }
    }

    // 5. 处理当前消息
    const currentParts = await this.extractMessageParts(ctx.messages);

    if (quoteTextPrefix) {
      const textPartIndex = currentParts.findIndex((p) => p.text);
      if (currentParts[textPartIndex]?.text) {
        currentParts[textPartIndex].text = quoteTextPrefix + currentParts[textPartIndex].text;
      } else {
        currentParts.push({ text: quoteTextPrefix });
      }
    }

    if (currentParts.length > 0) {
      historyChatContents.push({
        role: 'user',
        parts: currentParts,
      });
    }

    return historyChatContents;
  }

  /**
   * 处理 API 响应结果
   * @private
   */
  private async processGeminiResponse(
    ctx: ResponseContext,
    response: GenerateContentResponse,
    completeContents: Content[],
  ): Promise<void> {
    await sendFormattedMessage(response.text ?? '', ctx);

    completeContents.push(response.candidates![0]!.content!);

    chatContext.update(ctx.chat.id, ctx.user.id, completeContents);
  }
}

export const mentionHandler = new MentionHandler();
