import { BotMessages } from '@configs/bot-messages.js';
import { getFunctionTools } from '@configs/function-tools.js';
import { chatHistory } from '@data/chat-history.js';
import { longTermMemory } from '@data/long-term-memory.js';
import { promptStore } from '@data/prompt-store.js';
import { FunctionCallingConfigMode, type Content, type GenerateContentResponse, type Part } from '@google/genai';
import type { Message } from '@grammyjs/types';
import type { GeminiAgent } from '@llm/agent/gemini-agent.js';
import type { McpClient } from '@llm/mcp/mcp-client.js';
import type { ToolCallerInjectedDeps, ToolName } from '@llm/types/tool.js';
import type { FileHandler } from '@services/file-service.js';
import { CONFIG } from '@shared/core/config.js';
import { AgentError, AppError, TelegramError } from '@shared/core/errors.js';
import { logger } from '@shared/core/logger.js';
import { convertToMarkdownV2Chunks, toMarkdownV2 } from '@shared/markdown/telegram-converter.js';
import type { ApiResult } from '@shared/types/telegram.js';
import { formatTime, ms } from '@shared/utils/helpers.js';
import { hasFile } from '@shared/utils/message.js';
import { isCoreContentSimilar } from '@shared/utils/string-similarity.js';
import type { ResponseContext } from '@telegram/bot/response-context.js';
import type { HandlerWorkers } from '@telegram/handlers/types.js';

export class MentionHandler {
  private fileHandler: FileHandler;
  private agent: GeminiAgent;
  private toolCaller: ToolCallerInjectedDeps;
  private mcpClient: McpClient;

  private readonly botName = CONFIG.TELEGRAM_BOT_USERNAME;
  private readonly processingLocks = new Set<string>();

  constructor(workers: HandlerWorkers) {
    this.fileHandler = workers.fileHandler;
    this.agent = workers.geminiApiAgent;
    this.toolCaller = workers.toolCaller;
    this.mcpClient = workers.mcpClient;
  }

  public async handle(ctx: ResponseContext, messages: Message[]) {
    const { chat, user, message } = ctx;
    logger.debug('Received mention', {
      chatId: chat.id,
      userId: user.id,
      messageId: message.message_id,
    });

    if (!this.checkProcessingLocks(ctx)) return;

    try {
      await this.checkFile(ctx);

      const chatContents = await this.buildChatContents(messages);

      if (!this.checkContents(chatContents, ctx)) return;

      const historyContents = chatHistory.get(chat.id, user.id);

      if (chatContents.at(0)?.role === 'model' && historyContents.at(-1)?.role === 'model') {
        const isConnectedSimilar = isCoreContentSimilar(
          chatContents
            .at(0)
            ?.parts?.map((p) => p.text ?? '')
            .join('')
            .trim() ?? '',
          historyContents
            .at(-1)
            ?.parts?.map((p) => p.text ?? '')
            .join('')
            .trim() ?? '',
        );
        if (isConnectedSimilar) {
          logger.info(
            'The quoted object in the message is similar to the final model response, and it has been removed from the content.',
          );
          chatContents.shift();
        }
      }

      const completeContents = [...historyContents, ...chatContents];

      await ctx.reply(BotMessages.thinking);

      const geminiResponse = await this.delegateQuestionProcess(completeContents, ctx);

      await this.resolveResponse(ctx, geminiResponse, completeContents);
    } catch (apiError) {
      logger.error('Error during Gemini API call or response processing.', {
        err: apiError,
        chatId: chat.id,
        messageId: message.message_id,
      });
      throw apiError instanceof AppError
        ? apiError
        : new AgentError(apiError instanceof Error ? apiError.message : String(apiError));
    } finally {
      this.processingLocks.delete(this.generateLockKey(ctx));
    }
  }

  private delegateQuestionProcess(contents: Content[], ctx: ResponseContext): Promise<GenerateContentResponse> {
    const userId = ctx.user.id;
    const userLanguage = ctx.user.language_code;
    const chatId = ctx.chat.id;
    const messageId = ctx.message.message_id;

    logger.info(`Processing over to ChatAgent`, {
      chatId,
      userId,
      messageId,
    });

    const onStatusUpdate = (text: string) => {
      return ctx.edit(toMarkdownV2(text), { parse_mode: 'MarkdownV2' });
    };

    const systemPrompt = promptStore.format('assistant', {
      time: formatTime(Date.now()),
      chatId: String(chatId),
      userId: String(userId),
      userLanguage: userLanguage ?? 'unknown',
      messageId: String(messageId),
      userMemories: longTermMemory.getMemories(userId),
    });

    return this.agent.run(contents, {
      onStatusUpdate,
      generateConfig: {
        temperature: 0,
        systemInstruction: [{ text: systemPrompt }],
        tools: [{ functionDeclarations: getFunctionTools(this.mcpClient.getLoadedServers()) }],
        toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
      },
      callTool: (name, args) => {
        return this.toolCaller(ctx, onStatusUpdate)[name as ToolName](args as never);
      },
    });
  }

  private async resolveResponse(ctx: ResponseContext, response: GenerateContentResponse, completeContents: Content[]) {
    const text = `${response.text?.trim()}\n\n *Reply by ${response.modelVersion}*`;
    const chunks = convertToMarkdownV2Chunks(text);
    let result: ApiResult<'editMessageText'>;
    if (chunks.length > 1) {
      const page = await ctx.api.publishTelegraphPost(text.split('\n')[0]!.slice(0, 256), text);
      const textToSend = toMarkdownV2(`AI 的回复过长，[点击这里查看](${page.url})`);
      result = await ctx.reply(textToSend, {
        link_preview_options: { url: page.url },
        parse_mode: 'MarkdownV2',
        deleteAfterMs: ms['1d'],
      });
    } else {
      result = await ctx.reply(chunks.join(''), {
        parse_mode: 'MarkdownV2',
        deleteAfterMs: ms['1d'],
      });
    }

    if (!result.ok) {
      throw new TelegramError(result.error);
    }
    completeContents.push(response.candidates![0]!.content!);
    chatHistory.update(ctx.chat.id, ctx.user.id, completeContents);
  }

  private async buildChatContents(messages: Message[]): Promise<Content[]> {
    const contents: Content[] = [];
    const replyToMessage = messages.find((m) => m.reply_to_message)?.reply_to_message;
    const quotedText = messages.find((m) => m.quote)?.quote?.text;
    const quoteTextPrefix = quotedText ? `❝ Quoted: "${quotedText}"\n\n` : undefined;

    if (replyToMessage) {
      const replyToParts = await this.extractMessageParts([replyToMessage]);
      if (replyToParts.length > 0) {
        const replyRole = replyToMessage.from?.username === this.botName ? 'model' : 'user';
        contents.push({
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
      contents.push({
        role: 'user',
        parts: currentParts,
      });
    }

    return contents;
  }

  private async extractMessageParts(messages: Message[]): Promise<Part[]> {
    const parts: Part[] = [];

    const fileParts = await this.fileHandler.batchProcessFiles(messages, hasFile);

    parts.push(...fileParts);

    const mentionRegex = new RegExp(`@${this.botName}`, 'gi');

    const combinedText = messages
      .flatMap((msg) => {
        const text = msg.text ?? msg.caption;
        if (!text?.length) return [];
        return [
          text
            .replace(mentionRegex, '')
            .replace(/^:ask/gi, '')
            .replace(/^🤖 模型：.*?\n+/g, '')
            .replace(/Reply by[\s\S]*$/m, '')
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

  private async checkFile(ctx: ResponseContext) {
    if (!ctx.isFile) return;
    await ctx.send(BotMessages.uploading, { isToReply: true });
  }

  private checkContents(contents: Content[], ctx: ResponseContext): boolean {
    if (contents.at(-1)?.role === 'model' || contents.length === 0) {
      logger.warn(`Invalid contents ignored.`);
      void ctx.reply(BotMessages.invalidContents, {
        deleteAfterMs: ms['3m'],
      });

      return false;
    }
    return true;
  }

  private generateLockKey(ctx: ResponseContext): string {
    return `${ctx.chat.id}:${ctx.user.id}`;
  }
}
