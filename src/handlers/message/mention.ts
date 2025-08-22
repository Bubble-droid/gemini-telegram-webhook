// src/handlers/message/mention.ts

import { BotConfig, TelegramBot, ChatContexts, Log, GeminiApi, GeminiError, TelegramError } from '@/services';
import type { Message, GenerateContentSuccessResponse } from '@/types';
import type { Content, Part } from '@google/genai'; // 确保 Part 类型导入
import { rateLimiterCheck, scheduleDeletion, sleep } from '@/utils';
import { handleFile } from '@/handlers/file';

/**
 * 检查消息是否包含文件（文档或照片）
 * @param {Message | undefined} message - Telegram 消息对象，可能为 undefined
 * @returns {boolean} - 如果消息包含文件，返回 true，否则返回 false
 */
const containsFile = (message: Message | undefined): boolean => {
  return message ? (message.document || message.photo ? true : false) : false;
};

/**
 * @function extractMessageParts
 * @description 从 Telegram 消息中提取适用于 Gemini API 的内容部分（文本和文件数据）。
 *              同时处理移除 Bot 提及的逻辑。
 * @param {Message} message - Telegram 原始 Telegram 消息对象。
 * @param {string} botName - Bot 的用户名。
 * @returns {Promise<Part[]>} 包含文件数据和文本内容的 parts 数组。
 */
const extractMessageParts = async (message: Message, botName: string): Promise<Part[]> => {
  const parts: Part[] = [];
  let messageText = message.text || message.caption || '';
  messageText = messageText.replace(`@${botName}`, '').trim();

  // 处理文件内容（文档、图片）
  if (containsFile(message)) {
    const fileData = await handleFile(message);

    if (fileData) {
      parts.push({ inlineData: fileData });
    }

    // 如果没有提供文本，设置默认提示
    if (!messageText) {
      if (message.document) messageText = '分析这个文件';
      else if (message.photo) messageText = '分析这张图片';
    }
  }

  parts.push({ text: messageText ? messageText : '你好！' });

  return parts;
};

/**
 * @class MentionHandler
 * @description 封装处理提及 Bot 消息或回复 Bot 消息的逻辑。
 */
export class MentionHandler {
  // Telegram 消息的最大字符长度限制
  private static readonly MAX_TELEGRAM_MESSAGE_LENGTH: number = 4096;
  // 分块发送时每个分块的字符长度
  private static readonly CHUNK_SIZE: number = 2048;

  /**
   * 检查并处理速率限制。
   * @param {Message} message - Telegram 消息对象。
   * @param {number | undefined} adminId - 管理员用户 ID。
   * @returns {Promise<boolean>} 如果被速率限制并已发送提示，返回 `true`，否则返回 `false`。
   */
  private static async _handleRateLimiting(message: Message, adminId: number | undefined): Promise<boolean> {
    const { message_id: userMessageId, from, chat } = message;
    const checkResult = await rateLimiterCheck(chat.id);

    if (!checkResult.canProceed && from?.id !== adminId) {
      Log.info(`Rate limit exceeded for chat ${chat.id}. Retry after ${checkResult.retryAfterSeconds} seconds.`);
      const { messageId: rateLimitMessageId } = await TelegramBot.sendMessage(
        chat.id,
        `超出速率限制，请等待 ${checkResult.retryAfterSeconds} 秒后重试。`,
        userMessageId,
      );
      if (rateLimitMessageId) {
        void scheduleDeletion({ chat_id: chat.id, message_id: rateLimitMessageId }, checkResult.retryAfterSeconds * 1_000);
      }
      return true; // 表示已处理速率限制
    }
    return false; // 未被速率限制，可以继续
  }

  /**
   * 发送“文件上传中”提示消息。
   * @param {Message} message - 当前消息。
   * @param {Message | undefined} replyToMessage - 被回复的消息。
   * @param {number} chatId - 聊天 ID。
   * @param {number} userMessageId - 用户消息 ID。
   * @returns {Promise<number | null>} 文件上传提示消息的 ID，如果没有文件则为 null。
   */
  private static async _sendFileUploadMessage(
    message: Message,
    replyToMessage: Message | undefined,
    chatId: number,
    userMessageId: number,
  ): Promise<number | null> {
    if (containsFile(message) || containsFile(replyToMessage)) {
      const { messageId: uploadingMessageId } = await TelegramBot.sendMessage(chatId, '📄 File uploading...', userMessageId);
      return uploadingMessageId || null;
    }
    return null;
  }

  /**
   * 构建发送给 Gemini API 的完整内容历史。
   * @param {number} chatId - 聊天 ID。
   * @param {number | undefined} fromUserId - 发送消息的用户 ID。
   * @param {Message} currentMessage - 当前用户消息。
   * @param {string} botName - Bot 的用户名。
   * @param {number} botId - Bot 的用户 ID。
   * @returns {Promise<Content[]>} 完整的对话内容数组。
   */
  private static async _buildCompleteContents(
    chatId: number,
    fromUserId: number | undefined,
    currentMessage: Message,
    botName: string,
  ): Promise<Content[]> {
    const historyChatContents = await ChatContexts.get(chatId, fromUserId as number);
    const completeContents: Content[] = [...historyChatContents];

    // 处理被回复的消息（如果存在）
    if (currentMessage.reply_to_message) {
      const replyToParts = await extractMessageParts(currentMessage.reply_to_message, botName);
      if (replyToParts.length > 0) {
        // 判断被回复消息的角色：如果是 Bot，则是 'model'；否则是其他用户，是 'user'。
        const replyRole = currentMessage.reply_to_message.from?.username === botName ? 'model' : 'user';
        completeContents.push({
          role: replyRole,
          parts: replyToParts,
        });
      }
    }

    // 处理当前消息，总是用户角色
    const currentParts = await extractMessageParts(currentMessage, botName);
    if (currentParts.length > 0) {
      completeContents.push({
        role: 'user',
        parts: currentParts,
      });
    }

    // 检查 completeContents 是否为空，如果为空则抛出错误
    if (completeContents.length === 0) {
      throw new TelegramError('未能从消息中提取到有效内容，请检查消息格式。');
    }

    return completeContents;
  }

  /**
   * 发送“思考中”提示消息。
   * @param {number} chatId - 聊天 ID。
   * @param {number} userMessageId - 用户消息 ID。
   * @returns {Promise<number>} 思考中消息的 ID。
   * @throws {Error} 如果发送失败。
   */
  private static async _sendThinkingMessage(chatId: number, userMessageId: number): Promise<number> {
    const { messageId: thinkMessageId } = await TelegramBot.sendMessage(chatId, '✨ Thinking...', userMessageId);
    if (!thinkMessageId) {
      Log.error('Failed to send thinking message.');
      throw new TelegramError('Failed to send thinking message.');
    }
    return thinkMessageId;
  }

  /**
   * 根据文本长度分块发送消息。
   * 如果文本长度不超过 4096，则直接发送。
   * 如果超过 4096，则按 2048 字符分块发送，并保持回复线程。
   * @param {number} chatId - 聊天 ID。
   * @param {string} fullText - 要发送的完整文本。
   * @param {number} userMessageId - 用户原始消息的 ID，用于第一个分块的回复。
   * @param {number} deletionDurationMs - 消息的删除持续时间（毫秒）。
   * @throws {Error} 如果任何分块发送失败。
   */
  private static async _sendLongMessageInChunks(chatId: number, fullText: string, userMessageId: number, deletionDurationMs: number): Promise<void> {
    if (fullText.length <= MentionHandler.MAX_TELEGRAM_MESSAGE_LENGTH) {
      // 如果文本长度在 Telegram 单条消息限制内，直接发送
      const { ok: sendOk, messageId: replyMessageId } = await TelegramBot.sendMessage(chatId, fullText, userMessageId);
      if (!sendOk) {
        throw new TelegramError('发送最终回复消息时发生未知错误。');
      }
      if (replyMessageId) {
        void scheduleDeletion({ chat_id: chatId, message_id: replyMessageId }, deletionDurationMs);
      }
    } else {
      // 文本超过限制，需要分块发送
      const chunks: string[] = [];
      for (let i = 0; i < fullText.length; i += MentionHandler.CHUNK_SIZE) {
        chunks.push(fullText.substring(i, i + MentionHandler.CHUNK_SIZE));
      }

      let currentReplyToMessageId: number | undefined = userMessageId; // 第一个分块回复用户消息

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const { ok: sendOk, messageId: sentMessageId } = await TelegramBot.sendMessage(chatId, chunk, currentReplyToMessageId, 'HTML', false);

        if (!sendOk) {
          Log.error(`发送第 ${i + 1} 个回复消息分块时发生未知错误。`, { chatId, chunkIndex: i });
          throw new TelegramError(`发送第 ${i + 1} 个回复消息分块时发生未知错误。`);
        }

        if (sentMessageId) {
          // 为每个分块安排删除
          void scheduleDeletion({ chat_id: chatId, message_id: sentMessageId }, deletionDurationMs);
          // 后续分块回复前一个发送的消息，以保持线程
          currentReplyToMessageId = sentMessageId;
        } else {
          // 理论上不会发生，因为 sendOk 为 true 通常意味着 messageId 存在
          Log.warn(`发送第 ${i + 1} 个分块后未获取到消息 ID。`, { chatId, chunkIndex: i });
        }
      }
    }
  }

  /**
   * 处理 Gemini API 的成功响应，包括显示思考内容、最终回复和更新聊天上下文。
   * @param {GenerateContentSuccessResponse} geminiResponse - Gemini API 的成功响应对象。
   * @param {number} chatId - 聊天 ID。
   * @param {number} userMessageId - 用户消息 ID。
   * @param {number} thinkMessageId - “思考中”消息的 ID。
   * @param {string} modelName - 使用的模型名称。
   * @param {number} fromUserId - 发送消息的用户 ID。
   * @param {Content[]} completeContentsBeforeCall - 调用 Gemini API 前的完整对话内容（用于更新历史）。
   * @returns {Promise<boolean>}
   * @throws {Error} 如果发送回复消息失败或模型未返回有效文本。
   */
  private static async _processGeminiResponse(
    geminiResponse: GenerateContentSuccessResponse,
    chatId: number,
    userMessageId: number,
    thinkMessageId: number,
    modelName: string,
    fromUserId: number,
    completeContentsBeforeCall: Content[],
  ): Promise<boolean> {
    let hasDisplayedThoughts: boolean = false;

    const {
      response,
      apiCallSuccessCount,
      totalRetryCount,
      totalUsageToken,
      usageToolCount,
      totalDurationSecond,
      hasToolThoughts, // 模型是否生成了思考 Part
      emptyReplyRetryCount,
      errorRetryCount,
    } = geminiResponse;

    // 提取“思考”文本：从 `response.parts` 中过滤出带有 `thought` 属性的 Part
    const resThoughtParts = response.parts?.filter((part) => part.text && part.thought);
    const resThoughtTexts = resThoughtParts
      ?.map((part) => part.text)
      .join('')
      .trim();

    if (resThoughtTexts) {
      hasDisplayedThoughts = true;
      const displayThoughtText = (() => {
        const strArr = Array.from(resThoughtTexts);
        if (strArr.length > 4096) {
          return `${strArr.slice(0, 2000).join('')}\n\n......\n\n${strArr.slice(strArr.length - 2000).join('')}`.trim();
        }
        return resThoughtTexts;
      })();
      await TelegramBot.editMessageText(
        chatId,
        thinkMessageId,
        `*Thoughts*:\n\n<blockquote expandable>${displayThoughtText}</blockquote>`,
        'HTML',
        false,
      );
    }

    // 根据模型是否生成了思考内容 (`hasToolThoughts`) 和是否实际显示了思考文本 (`hasDisplayedThoughts`)，
    // 决定是删除“思考中”消息还是安排其删除。
    if (!hasToolThoughts && !hasDisplayedThoughts) {
      await TelegramBot.deleteMessage(chatId, thinkMessageId);
    } else {
      void scheduleDeletion({ chat_id: chatId, message_id: thinkMessageId }, 30 * 60_000);
    }

    // 提取最终的回复文本（非思考内容）：从 `response.parts` 中过滤掉带有 `thought` 属性的 Part
    const resTextParts = response.parts?.filter((part) => part.text && !part.thought);
    const resTexts = resTextParts
      ?.map((part) => part.text)
      .join('')
      .trim();

    if (!resTexts) {
      // 理论上，GeminiApi 内部的空回复重试机制应该处理此情况。
      // 但作为防御性编程，如果模型最终只返回了工具调用而没有文本，或者返回了空文本，
      // 我们仍然需要一个用户友好的提示。
      throw new GeminiError('Gemini API 未返回有效文本回复：模型可能只生成了工具调用或思考内容。');
    }

    const fullText = `🤖 模型：\`${modelName}\`

${resTexts}

*✨ 本次任务共成功调用 Gemini API ${apiCallSuccessCount} 次，${totalRetryCount} 次重试：无效回复 ${emptyReplyRetryCount} 次，客户端错误 ${errorRetryCount} 次，使用工具数：${usageToolCount}，耗时：${totalDurationSecond} 秒，消耗 Token：${totalUsageToken}*

*⚠ 本 AI 回答仅供参考，可能存在不准确之处，请您自行判断。*`;

    // 调用新的分块发送函数来处理回复消息
    await MentionHandler._sendLongMessageInChunks(chatId, fullText, userMessageId, 24 * 60 * 60_000);

    // 更新聊天记录，保存用户提问和 Bot 回复
    // completeContentsBeforeCall 已经包含了历史记录和用户当前提问
    // 只需将模型本次回复添加到历史记录中
    const botResponseContent: Content = {
      role: 'model',
      parts: response.parts, // 保存模型所有 parts，包括思考内容，以便上下文完整
    };

    await ChatContexts.update(chatId, fromUserId, [
      ...completeContentsBeforeCall, // 现有历史记录 + 用户当前提问
      botResponseContent, // 模型本次回复
    ]);

    return hasDisplayedThoughts;
  }

  /**
   * 处理提及 Bot 的消息或回复 Bot 消息的普通消息。
   * @param {Message} message - Telegram 消息对象。
   * @param {boolean} [isChat=false] - 可选参数，如果为 `true`，则表示此消息是群组内的普通消息，但回复了 Bot 的消息，因此无需再次检查是否提及 Bot。
   * @returns {Promise<void>}
   */
  public static async handleMention(message: Message, isChat: boolean = false): Promise<void> {
    const { modelName, botName, adminId } = BotConfig.load();
    const { message_id: userMessageId, from, chat, reply_to_message } = message;

    Log.info('Handling mention message.', {
      chatId: chat.id,
      messageId: userMessageId,
      isChatMode: isChat,
    });

    // 1. 检查并处理速率限制
    if (await MentionHandler._handleRateLimiting(message, adminId)) {
      return; // 被速率限制，直接返回
    }

    let fileUploadMessageId: number | null = null;
    let thinkMessageId: number | null = null;
    let completeContents: Content[] = [];
    let hasResThought: boolean = false;

    try {
      // 2. 发送文件上传提示消息（如果包含文件）
      fileUploadMessageId = await MentionHandler._sendFileUploadMessage(message, reply_to_message, chat.id, userMessageId);

      // 3. 构建发送给 Gemini API 的完整内容历史
      completeContents = await MentionHandler._buildCompleteContents(chat.id, from?.id, message, botName);

      // 4. 删除文件上传提示消息（如果存在）
      if (fileUploadMessageId) {
        await sleep(3_000);
        await TelegramBot.deleteMessage(chat.id, fileUploadMessageId);
        fileUploadMessageId = null; // 清空 ID，防止 finally 再次尝试删除
      }

      // 5. 发送“思考中”提示消息
      thinkMessageId = await MentionHandler._sendThinkingMessage(chat.id, userMessageId);

      // 6. 调用 Gemini API
      const geminiResponse: GenerateContentSuccessResponse = await GeminiApi.generateContent(completeContents, {
        chatId: chat.id,
        thinkMessageId,
      });

      // 7. 处理 Gemini API 响应并发送回复
      hasResThought = await MentionHandler._processGeminiResponse(
        geminiResponse,
        chat.id,
        userMessageId,
        thinkMessageId,
        modelName,
        from?.id as number,
        completeContents,
      );
    } catch (apiError: unknown) {
      Log.error('Error during Gemini API call or response processing.', {
        err: apiError,
        chatId: chat.id,
        messageId: userMessageId,
      });

      // 确保文件上传消息被删除
      if (fileUploadMessageId) {
        await TelegramBot.deleteMessage(chat.id, fileUploadMessageId);
      }

      // 确保思考消息被正确处理（删除或安排删除）
      if (thinkMessageId) {
        const err = apiError instanceof GeminiError ? apiError : undefined;
        if (!err?.hasToolThoughts && !hasResThought) {
          await TelegramBot.deleteMessage(chat.id, thinkMessageId);
        } else {
          void scheduleDeletion({ chat_id: chat.id, message_id: thinkMessageId }, 30 * 60_000);
        }
      }
      throw apiError; // 重新抛出错误以便上层捕获
    }
  }
}

// 导出 handleMention 函数作为模块的默认导出，以便外部调用
export const handleMention: typeof MentionHandler.handleMention = MentionHandler.handleMention;
