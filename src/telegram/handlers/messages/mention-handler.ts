import { BotMessages } from '@configs/bot-messages';
import { FUNCTION_TOOLS } from '@configs/function-tools';
import { chatHistory } from '@data/chat-history';
import { longTermMemory } from '@data/long-term-memory';
import { promptStore } from '@data/prompt-store';
import {
  FunctionCallingConfigMode,
  type Content,
  type GenerateContentConfig,
  type GenerateContentResponse,
  type Part,
} from '@google/genai';
import type { GeminiAgent } from '@llm/agent/gemini-agent';
import { createToolCaller } from '@llm/tool/tool-call';
import type { ToolName } from '@llm/types/tool';
import type { FileHandler } from '@services/file-service';
import type { RateLimiter } from '@services/rate-limiter';
import { CONFIG } from '@shared/core/config';
import { logger } from '@shared/core/logger';
import { formatTime, ms } from '@shared/utils/helpers';
import { hasFile } from '@shared/utils/message';
import { sendFormattedChunks } from '@telegram/bot/formatted-send';
import type { ResponseContext } from '@telegram/bot/response-context';
import { toHtml } from '@telegram/markdown';
import type { Message } from 'grammy/types';

interface Workers {
  limiter: RateLimiter;
  fileHandler: FileHandler;
  agent: GeminiAgent;
}

export class MentionHandler {
  private limiter: RateLimiter;
  private fileHandler: FileHandler;
  private agent: GeminiAgent;
  private readonly botName = CONFIG.TELEGRAM_BOT_USERNAME;
  private readonly ownerId = CONFIG.TELEGRAM_BOT_OWNER_ID;
  private readonly processingLocks = new Set<string>();

  constructor(workers: Workers) {
    this.limiter = workers.limiter;
    this.fileHandler = workers.fileHandler;
    this.agent = workers.agent;
  }

  public async handle(ctx: ResponseContext, messages: Message[]) {
    const { chat, user, message } = ctx;
    logger.debug('Received mention', {
      chatId: chat.id,
      userId: user.id,
      messageId: message.message_id,
    });

    if (!this.checkProcessingLocks(ctx)) return;

    if (!this.checkRateLimiting(ctx)) return;

    try {
      await this.checkFile(ctx);

      const completeContents = await this.buildCompleteContents(ctx, messages);

      if (!this.checkContents(completeContents, ctx)) return;

      await ctx.reply(BotMessages.thinking);

      const geminiResponse = await this.requestResponse(completeContents, ctx);

      await this.resolveResponse(ctx, geminiResponse, completeContents);
    } catch (apiError) {
      logger.error('Error during Gemini API call or response processing.', {
        err: apiError,
        chatId: chat.id,
        messageId: message.message_id,
      });

      if (ctx.lastMessageId) void ctx.api.deleteMessage(chat.id, ctx.lastMessageId);

      throw apiError;
    } finally {
      this.processingLocks.delete(this.generateLockKey(ctx));
    }
  }

  private requestResponse(contents: Content[], ctx: ResponseContext): Promise<GenerateContentResponse> {
    const userId = ctx.user.id;
    const chatId = ctx.chat.id;
    const messageId = ctx.message.message_id;

    logger.info(`Processing over to ChatAgent`, {
      chatId,
      userId,
      messageId,
    });

    const onStatusUpdate = (text: string) => {
      return ctx.edit(toHtml(text), { parse_mode: 'HTML' });
    };

    const systemPrompt = promptStore.format('assistant', {
      time: formatTime(Date.now()),
      chatId: String(chatId),
      userId: String(userId),
      messageId: String(messageId),
      userMemories: longTermMemory.getMemories(userId),
    });

    const genConfig: GenerateContentConfig = {
      systemInstruction: [{ text: systemPrompt }],
      tools: [{ functionDeclarations: FUNCTION_TOOLS }],
      toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
    };

    return this.agent.run(contents, {
      geminiApiOptions: {
        genConfig,
      },
      callTool: (name, args) => {
        return createToolCaller(ctx.api, this.agent, onStatusUpdate)[name as ToolName](args as never);
      },
      onStatusUpdate,
    });
  }

  private async resolveResponse(ctx: ResponseContext, response: GenerateContentResponse, completeContents: Content[]) {
    await sendFormattedChunks(response.text!, ctx);
    completeContents.push(response.candidates![0]!.content!);
    chatHistory.update(ctx.chat.id, ctx.user.id, completeContents);
  }

  private async buildCompleteContents(ctx: ResponseContext, messages: Message[]): Promise<Content[]> {
    const history: Content[] = [...chatHistory.get(ctx.chat.id, ctx.user.id)];
    const replyToMessage = messages.find((m) => m.reply_to_message)?.reply_to_message;
    const quotedText = messages.find((m) => m.quote)?.quote?.text;
    const quoteTextPrefix = quotedText ? `❝ Quoted: "${quotedText}"\n\n` : undefined;

    if (replyToMessage) {
      const replyToParts = await this.extractMessageParts([replyToMessage]);
      if (replyToParts.length > 0) {
        const replyRole = replyToMessage.from?.username === this.botName ? 'model' : 'user';
        history.push({
          role: replyRole,
          parts: replyToParts,
        });
      }
    }

    const currentParts = await this.extractMessageParts(messages);

    if (quoteTextPrefix) {
      const textPartIndex = currentParts.findIndex((p) => p.text);
      if (currentParts[textPartIndex]?.text) {
        currentParts[textPartIndex].text = quoteTextPrefix + currentParts[textPartIndex].text;
      } else {
        currentParts.push({ text: quoteTextPrefix });
      }
    }

    if (currentParts.length > 0) {
      history.push({
        role: 'user',
        parts: currentParts,
      });
    }

    return history;
  }

  private async extractMessageParts(messages: Message[]): Promise<Part[]> {
    const parts: Part[] = [];

    const fileParts = await this.fileHandler.batchProcessFiles(messages, hasFile);

    parts.push(...fileParts);

    const mentionRegex = new RegExp(`@${this.botName}`, 'gi');

    const combinedText = messages
      .flatMap((msg) => {
        const text = msg.text ?? msg.caption ?? '';
        if (!text.length) return [];
        return [
          text
            .replace(mentionRegex, '')
            .replace(/^:ask/gi, '')
            .replace(/^🤖 模型：.*?\n+/g, '')
            .replace(/⚠️ 本 AI[\s\S]*$/m, '')
            .trim(),
        ];
      })
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

  private checkProcessingLocks(ctx: ResponseContext): boolean {
    const lockKey = this.generateLockKey(ctx);
    if (!this.processingLocks.has(lockKey)) {
      this.processingLocks.add(lockKey);
      return true;
    }

    logger.warn(`[MentionHandler] Ignored concurrent request from ${lockKey}`);
    void ctx.send(BotMessages.pendingRequest, {
      opts: { deleteAfterMs: ms['3m'] },
      isToReply: true,
    });
    return false;
  }

  private checkRateLimiting(ctx: ResponseContext): boolean {
    const checkResult = this.limiter.check(ctx.chat.id);

    if (checkResult.canProceed || ctx.user.id === this.ownerId) return true;

    logger.warn(`Rate limit exceeded for chat ${ctx.chat.id}. Retry after ${checkResult.retryAfterSeconds} seconds.`);

    void ctx.send(BotMessages.getRateLimiting(checkResult.retryAfterSeconds), {
      opts: {
        deleteAfterMs: ms.sec(checkResult.retryAfterSeconds),
      },
      isToReply: true,
    });

    return false;
  }

  private async checkFile(ctx: ResponseContext) {
    if (!ctx.isFile) return;
    await ctx.send(BotMessages.uploading, { isToReply: true });
  }

  private checkContents(contents: Content[], ctx: ResponseContext): boolean {
    if (contents.at(-1)?.role !== 'model') return true;
    logger.warn(`Invalid contents ignored.`);
    void ctx.reply(BotMessages.invalidContents, {
      deleteAfterMs: ms['3m'],
    });

    return false;
  }

  private generateLockKey(ctx: ResponseContext): string {
    return `${ctx.chat.id}:${ctx.user.id}`;
  }
}
