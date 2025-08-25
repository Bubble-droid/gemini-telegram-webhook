// src/handlers/message/mention.ts

import { BotConfig, TelegramBot, ChatContexts, Log, GeminiApi, GeminiError, TelegramError } from '@/services';
import type { Message, GenerateContentSuccessResponse } from '@/types';
import type { Content, Part } from '@google/genai';
import { rateLimiterCheck, scheduleDeletion, sleep } from '@/utils';
import { escapeHtml } from '@/utils/formatting';
import { handleFile } from '@/handlers/file';
import { sendFormattedMessage } from '@/utils/formatting';
import { getAggregatedMediaGroup, type AggregatedMessage, MEDIA_GROUP_COLLECTION_TIMEOUT_MS } from '@/utils'; // 导入新的工具和类型

/**
 * 检查消息是否包含 handleFile 支持的文件类型（文档或照片）
 * @param {Message | undefined} message - Telegram 消息对象，可能为 undefined
 * @returns {boolean} - 如果消息包含 `handleFile` 能处理的文件，返回 true，否则返回 false
 */
const containsFile = (message: Message | undefined): boolean => {
  return message ? !!message.document || !!message.photo : false;
};

/**
 * @function extractMessageParts
 * @description 从 Telegram 消息数组中提取适用于 Gemini API 的内容部分（文本和文件数据）。
 *              同时处理移除 Bot 提及的逻辑。
 * @param {Message[]} messages - Telegram 原始 Telegram 消息对象数组（可能来自媒体组）。
 * @param {string} botName - Bot 的用户名。
 * @param {string | undefined} consolidatedCaption - 整个媒体组或单条消息的统一标题或文本。
 * @returns {Promise<Part[]>} 包含文件数据和文本内容的 parts 数组。
 */
const extractMessageParts = async (messages: Message[], botName: string, consolidatedCaption: string | undefined = undefined): Promise<Part[]> => {
  const parts: Part[] = [];
  let messageText = consolidatedCaption || ''; // 优先使用传入的合并标题
  let hasFile = false;

  // 遍历所有消息以收集文件内容
  for (const message of messages) {
    if (containsFile(message)) {
      hasFile = true;
      const fileData = await handleFile(message); // handleFile 已经返回 Blob | void

      if (fileData) {
        parts.push({ inlineData: fileData });
      }
    }
    // 如果没有传入合并标题，并且当前消息有文本/标题，则将其作为 messageText
    // 这有助于处理媒体组中只有某个消息有标题的情况
    if (!messageText && (message.text || message.caption)) {
      messageText = message.text || message.caption || '';
    }
  }

  // 从最终确定的文本内容中移除 Bot 提及
  messageText = messageText.replace(new RegExp(`@${botName}`, 'g'), '').trim();

  // 如果有文件但没有文本，设置默认提示
  if (hasFile && !messageText) {
    messageText = '分析这些文件'; // 更通用的多文件提示
  }

  // 添加文本部分，确保它在清理后不为空
  if (messageText) {
    parts.push({ text: messageText });
  } else if (!hasFile) {
    // 如果没有文件也没有文本，发送默认问候
    parts.push({ text: '你好！' });
  }

  return parts;
};

/**
 * @class MentionHandler
 * @description 封装处理提及 Bot 消息或回复 Bot 消息的逻辑。
 */
export class MentionHandler {
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
      const rateLimitResult = await TelegramBot.sendMessage(
        chat.id,
        `超出速率限制，请等待 ${checkResult.retryAfterSeconds} 秒后重试。`,
        'HTML',
        userMessageId,
      );
      if (rateLimitResult.ok) {
        void scheduleDeletion({ chat_id: chat.id, message_id: rateLimitResult.messageId }, checkResult.retryAfterSeconds * 1_000);
      }
      return true; // 表示已处理速率限制
    }
    return false; // 未被速率限制，可以继续
  }

  /**
   * 发送“文件上传中”提示消息。
   * @param {number} chatId - 聊天 ID。
   * @param {number} userMessageId - 用户消息 ID。
   * @returns {Promise<number | null>} 文件上传提示消息的 ID，如果没有文件则为 null。
   */
  private static async _sendFileUploadMessage(chatId: number, userMessageId: number): Promise<number | null> {
    const uploadingResult = await TelegramBot.sendMessage(chatId, '📄 File uploading...', 'HTML', userMessageId);
    return uploadingResult.ok ? uploadingResult.messageId : null;
  }

  /**
   * 构建发送给 Gemini API 的完整内容历史。
   * @param {number} chatId - 聊天 ID。
   * @param {number | undefined} fromUserId - 发送消息的用户 ID。
   * @param {AggregatedMessage} currentAggregatedMessage - 当前聚合后的用户消息（可能包含多个媒体）。
   * @param {string} botName - Bot 的用户名。
   * @returns {Promise<Content[]>} 完整的对话内容数组。
   */
  private static async _buildCompleteContents(
    chatId: number,
    fromUserId: number | undefined,
    currentAggregatedMessage: AggregatedMessage,
    botName: string,
  ): Promise<Content[]> {
    const historyChatContents = await ChatContexts.get(chatId, fromUserId as number);
    const completeContents: Content[] = [...historyChatContents];

    // 获取当前聚合消息中的第一条消息，用于获取一些通用上下文信息（如 reply_to_message）
    const firstCurrentMessage = currentAggregatedMessage.messages[0];

    // 处理被回复的消息（如果存在）
    if (firstCurrentMessage.reply_to_message) {
      const replyToMessage = firstCurrentMessage.reply_to_message;
      const replyRole = replyToMessage.from?.username === botName ? 'model' : 'user';

      // ⚠️ 注意: 对于被回复的媒体组，Telegram API 在 `reply_to_message` 字段中只提供单个消息对象。
      // 要获取整个被回复的媒体组的所有媒体，需要实现一个全局消息缓存机制或调用额外的 Telegram API 来查询历史消息。
      // 在当前代码改进的范围内，我们仅处理 `reply_to_message` 对象本身包含的媒体（如果有）。
      // 如果 `reply_to_message` 恰好是媒体组中的某个媒体消息，我们将只处理这一个媒体。
      const repliedParts = await extractMessageParts(
        [replyToMessage], // 将被回复消息视为单条消息处理
        botName,
        replyToMessage.text || replyToMessage.caption || '',
      );

      if (repliedParts.length > 0) {
        completeContents.push({
          role: replyRole,
          parts: repliedParts,
        });
      }
    }

    // 处理当前聚合消息（用户发送的媒体组或单条消息）
    let currentMessageText = currentAggregatedMessage.caption || '';

    // 如果当前消息中包含引用，将其添加到消息文本前
    if (firstCurrentMessage.quote?.text) {
      currentMessageText = `引用: "${firstCurrentMessage.quote.text}"\n\n${currentMessageText}`;
    }

    const currentParts = await extractMessageParts(
      currentAggregatedMessage.messages, // 传入所有聚合消息
      botName,
      currentMessageText, // 传入聚合后的标题/文本（可能已包含引用）
    );

    if (currentParts.length > 0) {
      completeContents.push({
        role: 'user',
        parts: currentParts,
      });
    }

    // 检查 completeContents 是否为空，如果为空则抛出错误
    if (completeContents.length === 0) {
      throw new TelegramError('未能从消息中提取到有效内容，请检查消息格式或媒体组内容。');
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
    const thinkingResult = await TelegramBot.sendMessage(chatId, '✨ Thinking...', 'HTML', userMessageId);
    if (!thinkingResult.ok) {
      Log.error('Failed to send thinking message.');
      throw new TelegramError('Failed to send thinking message.');
    }
    return thinkingResult.messageId;
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
        `<b>Thoughts</b>:\n\n<blockquote expandable>${escapeHtml(displayThoughtText)}</blockquote>`,
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
      throw new GeminiError('Gemini API 未返回有效文本回复：模型可能只生成了工具调用或思考内容。');
    }

    const fullText = `🤖 模型：\`${modelName}\`

${resTexts}

_✨ 本次任务共成功调用 Gemini API ${apiCallSuccessCount} 次，${totalRetryCount} 次重试：无效回复 ${emptyReplyRetryCount} 次，客户端错误 ${errorRetryCount} 次，使用工具数：${usageToolCount}，耗时：${totalDurationSecond} 秒，消耗 Token：${totalUsageToken}_

_⚠ 本 AI 回答仅供参考，可能存在不准确之处，请您自行判断。_`;

    // 调用新的分块发送函数来处理回复消息
    const { ok: sendOk, error: sendError } = await sendFormattedMessage(chatId, fullText, userMessageId);

    if (!sendOk) {
      const error = sendError ? sendError : new TelegramError('发送消息时发生未知错误');
      throw error;
    }

    // 更新聊天记录，保存用户提问和 Bot 回复
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
   * 处理聚合后的消息（无论是单个消息还是媒体组）。
   * 这是一个内部方法，包含了 `handleMention` 的核心逻辑。
   * @param {AggregatedMessage} aggregatedMessage - 聚合后的消息对象。
   * @param {boolean} [isChat=false] - 可选参数，如果为 `true`，则表示此消息是群组内的普通消息，但回复了 Bot 的消息。
   * @returns {Promise<void>}
   */
  private static async _processAggregatedMessage(aggregatedMessage: AggregatedMessage, isChat: boolean = false): Promise<void> {
    const { modelName, botName, adminId } = BotConfig.load();
    // 使用聚合消息中的第一条消息作为主要上下文来源
    const firstMessage = aggregatedMessage.messages[0];
    const { message_id: userMessageId, from, chat } = firstMessage;

    Log.info('Processing aggregated mention message.', {
      chatId: chat.id,
      messageId: userMessageId,
      isChatMode: isChat,
      mediaGroupId: firstMessage.media_group_id,
      messageCount: aggregatedMessage.messages.length,
    });

    // 1. 检查并处理速率限制
    if (await MentionHandler._handleRateLimiting(firstMessage, adminId)) {
      return; // 被速率限制，直接返回
    }

    let fileUploadMessageId: number | null = null;
    let thinkMessageId: number | null = null;
    let completeContents: Content[] = [];
    let hasResThought: boolean = false;

    try {
      // 2. 发送文件上传提示消息（如果包含文件）
      // 检查聚合消息中是否有任何消息包含文件，或者被回复消息包含文件
      const anyMessageHasFile = aggregatedMessage.messages.some((msg) => containsFile(msg));
      const repliedMessageHasFile = firstMessage.reply_to_message ? containsFile(firstMessage.reply_to_message) : false;

      if (anyMessageHasFile || repliedMessageHasFile) {
        fileUploadMessageId = await MentionHandler._sendFileUploadMessage(chat.id, userMessageId);
      }

      // 3. 构建发送给 Gemini API 的完整内容历史
      completeContents = await MentionHandler._buildCompleteContents(chat.id, from?.id, aggregatedMessage, botName);

      // 4. 删除文件上传提示消息（如果存在）
      if (fileUploadMessageId) {
        // 等待一小段时间，确保用户能看到上传提示
        await sleep(MEDIA_GROUP_COLLECTION_TIMEOUT_MS);
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
      Log.error('Error during Gemini API call or response processing for aggregated message.', {
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

  /**
   * 处理提及 Bot 的消息或回复 Bot 消息的普通消息。
   * 如果消息属于媒体组，它将聚合所有媒体，然后处理。
   * @param {Message} message - Telegram 消息对象。
   * @param {boolean} [isChat=false] - 可选参数，如果为 `true`，则表示此消息是群组内的普通消息，但回复了 Bot 的消息，因此无需再次检查是否提及 Bot。
   * @returns {Promise<void>}
   */
  public static async handleMention(message: Message, isChat: boolean = false): Promise<void> {
    // 聚合媒体组消息。如果消息是媒体组的一部分，它会等待所有相关消息。
    // 如果不是媒体组，则立即返回包含单个消息的 AggregatedMessage 对象。
    // `getAggregatedMediaGroup` 会确保对于同一个 media_group_id，所有调用都等待同一个 Promise。
    const aggregatedMessage = await getAggregatedMediaGroup(message);

    // `getAggregatedMediaGroup` 在内部管理了 Promise 的生命周期。
    // 当 Promise 解析时，它会提供完整的聚合消息。
    // 此时，`_processAggregatedMessage` 才会真正执行。
    // 如果 `message.media_group_id` 存在，那么 `getAggregatedMediaGroup` 会返回一个 Promise，
    // 并且所有属于同一个 media group 的 `handleMention` 调用都会 `await` 这个 Promise。
    // `_processAggregatedMessage` 只需要被调用一次，由 Promise 解析触发。
    // `getAggregatedMediaGroup` 的设计确保了这点。
    await MentionHandler._processAggregatedMessage(aggregatedMessage, isChat);
  }
}

// 导出 handleMention 函数作为模块的默认导出，以便外部调用
export const handleMention: typeof MentionHandler.handleMention = MentionHandler.handleMention;
