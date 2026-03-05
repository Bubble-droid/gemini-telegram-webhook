import { RESEARCH_BOT_TOOLS } from '@configs/function-tools.js';
import { MENTIONED_ALIAS, Messages } from '@configs/messages.js';
import { chatHistory } from '@data/chat-history.js';
import { longTermMemory } from '@data/long-term-memory.js';
import { promptStore } from '@data/prompt-store.js';
import { FunctionCallingConfigMode, type Content, type Part } from '@google/genai';
import type { Message } from '@grammyjs/types';
import type { GeminiAgent } from '@llm/agent/gemini-agent.js';
import type { McpClient } from '@llm/mcp/mcp-client.js';
import type { GeminiAgentResponse } from '@llm/types/agent.js';
import type { ToolCallerInjectedDeps, ToolName } from '@llm/types/tool.js';
import type { FileHandler } from '@services/file-service.js';
import { AgentError, AppError } from '@shared/core/errors.js';
import { logger } from '@shared/core/logger.js';
import { markdownToMarkdownV2Chunks } from '@shared/markdown/telegram-converter.js';
import { formatTime, ms } from '@shared/utils/helpers.js';
import { hasFile } from '@shared/utils/message.js';
import { isCoreContentSimilar } from '@shared/utils/string-similarity.js';
import type { ResponseContext } from '@telegram/bot/response-context.js';
import type { HandlerWorkers } from '@telegram/handlers/types.js';

export class MentionHandler {
  private readonly fileHandler: FileHandler;
  private readonly agent: GeminiAgent;
  private readonly toolCaller: ToolCallerInjectedDeps;
  private readonly mcpClient: McpClient;

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
      messageId: message?.message_id,
    });

    if (!(await this.checkProcessingLocks(ctx))) return;

    try {
      await this.checkFile(ctx);

      const chatContents = await this.buildChatContents(messages, ctx);

      if (!(await this.checkContents(chatContents, ctx))) return;

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

      await ctx.updateMessage(Messages.thinking, { replyToMessageId: ctx.message?.message_id });

      const geminiResponse = await this.delegateQuestionProcess(completeContents, ctx);
      this.resolveResponse(ctx, geminiResponse, completeContents);
    } catch (apiError) {
      logger.error('Error during Gemini API call or response processing.', {
        err: apiError,
        chatId: chat.id,
        messageId: message?.message_id,
      });
      throw apiError instanceof AppError
        ? apiError
        : new AgentError(apiError instanceof Error ? apiError.message : String(apiError));
    } finally {
      this.processingLocks.delete(this.generateLockKey(ctx));
    }
  }

  private delegateQuestionProcess(contents: Content[], ctx: ResponseContext) {
    const { chat, user, message } = ctx;

    logger.info(`Processing over to ChatAgent`, {
      chatId: chat.id,
      userId: user.id,
      messageId: message?.message_id,
    });

    const updateStatus = async (text: string) => {
      await ctx
        .updateMessage(markdownToMarkdownV2Chunks(text)[0]!, {
          replyToMessageId: ctx.message?.message_id,
          parse_mode: 'MarkdownV2',
        })
        .catch((err: unknown) => {
          logger.warn(`Update status message failed.`, { err });
        });
    };

    const systemPrompt = promptStore.format('assistant', {
      time: formatTime(Date.now()),
      self: JSON.stringify(ctx.me),
      chat: JSON.stringify(chat),
      user: JSON.stringify(user),
      messageId: String(message?.message_id),
      userMemories: longTermMemory.getMemories(user.id),
    });

    return this.agent.run(contents, {
      ctx,
      updateStatus,
      generateConfig: {
        temperature: 0,
        systemInstruction: [{ text: systemPrompt }],
        tools: [{ functionDeclarations: RESEARCH_BOT_TOOLS(this.mcpClient.getLoadedServers()) }],
        toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
      },
      callTool: (name, args) => {
        return this.toolCaller(ctx, updateStatus)[name as ToolName](args as never);
      },
    });
  }

  private resolveResponse(ctx: ResponseContext, response: GeminiAgentResponse, completeContents: Content[]) {
    completeContents.push(response.candidates![0]!.content!);
    chatHistory.update(ctx.chat.id, ctx.user.id, completeContents);
  }

  private async buildChatContents(messages: Message[], ctx: ResponseContext): Promise<Content[]> {
    const contents: Content[] = [];
    const replyToMessage = messages.find((m) => m.reply_to_message)?.reply_to_message;
    const quotedText = messages.find((m) => m.quote)?.quote?.text;
    const quoteTextPrefix = quotedText ? `❝ Quoted: "${quotedText}"\n\n` : undefined;

    if (replyToMessage) {
      const replyToParts = await this.extractMessageParts([replyToMessage], ctx);
      if (replyToParts.length > 0) {
        const replyRole = replyToMessage.from?.username === ctx.me.username ? 'model' : 'user';
        contents.push({
          role: replyRole,
          parts: replyToParts,
        });
      }
    }

    const currentParts = await this.extractMessageParts(messages, ctx);

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

  private async extractMessageParts(messages: Message[], ctx: ResponseContext): Promise<Part[]> {
    const parts: Part[] = [];

    const fileParts = await this.fileHandler.batchProcessFiles(messages, hasFile);

    parts.push(...fileParts);

    const mentionRegex = new RegExp(`@${ctx.me.username}|^${MENTIONED_ALIAS}`, 'g');
    const combinedText = messages
      .flatMap((msg) => {
        const text = msg.text ?? msg.caption;
        if (!text?.length) return [];
        return [
          text
            .replace(mentionRegex, '')
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

  private async checkProcessingLocks(ctx: ResponseContext) {
    const lockKey = this.generateLockKey(ctx);
    if (!this.processingLocks.has(lockKey)) {
      this.processingLocks.add(lockKey);
      return true;
    }
    logger.warn(`[MentionHandler] Ignored concurrent request from ${lockKey}`);
    await ctx.reply(Messages.pendingRequest, { replyToMessageId: ctx.message?.message_id, deleteAfterMs: ms['3m'] });
    return false;
  }

  private async checkFile(ctx: ResponseContext) {
    if (!ctx.isFile) return;
    await ctx.updateMessage(Messages.uploading, { replyToMessageId: ctx.message?.message_id });
  }

  private async checkContents(contents: Content[], ctx: ResponseContext) {
    if (contents.at(-1)?.role === 'model' || contents.length === 0) {
      logger.warn(`Invalid contents ignored.`);
      await ctx.updateMessage(Messages.invalidContents, {
        replyToMessageId: ctx.message?.message_id,
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
