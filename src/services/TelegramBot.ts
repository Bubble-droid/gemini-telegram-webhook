import { config, TelegramError, Log } from '@/services';
import { BotCommands } from '@/configs';
import type { HttpMethod } from '@/types';
import type * as Bot from '@/types/telegram';
import { shortenString } from '@/utils';
import { escaper } from '@/utils/formatting';

/**
 * @class TelegramBot
 * @description 封装与 Telegram Bot API 的交互逻辑。
 */
export class TelegramBot {
  /**
   * 发送 API 请求的通用方法。
   * @private
   * @param {HttpMethod} httpMethod
   * @param {Bot.ApiMethod} apiMethod Telegram Bot API 方法名 (例如 'sendMessage')
   * @param {P} body - 请求体参数
   * @returns {Promise<T>} API 响应对象
   */
  private async sendRequest<P, T>(httpMethod: HttpMethod, apiMethod: Bot.ApiMethod, body: P, isFormData: boolean = false): Promise<T> {
    const { botApiUrl } = config.load();
    const url = `${botApiUrl}/${apiMethod}`;
    try {
      const response = await fetch(url, {
        method: String(httpMethod).toUpperCase(),
        ...(isFormData
          ? {}
          : {
              headers: {
                'Content-Type': 'application/json',
              },
            }),
        body: isFormData ? (body as FormData) : JSON.stringify(body),
      });

      const parsed = (await response.json()) as Bot.ApiResponse<T>;

      if (!parsed.ok) {
        const desc = parsed.description;
        const errCode = `API_FAILED_${String(apiMethod).toUpperCase()}_${response.status}`;
        Log.error(`Telegram API request failed for ${apiMethod}`, {
          apiMethod,
          statusCode: response.status,
          responseBody: parsed,
          customError: new TelegramError(`Telegram API error: ${desc}`, errCode),
        });
        throw new TelegramError(`Telegram API error: ${desc}`, errCode);
      }

      // 分开处理网络层面的错误，逻辑更清晰
      if (!response.ok) {
        const desc = `HTTP request failed with status: ${response.status}`;
        const errCode = `HTTP_ERROR_${response.status}`;
        Log.error(`Telegram API request failed for ${apiMethod}`, {
          apiMethod,
          statusCode: response.status,
          responseBody: parsed,
          customError: new TelegramError(desc, errCode),
        });
        throw new TelegramError(desc, errCode);
      }

      // 只有当 parsed.ok 和 response.ok 都为 true 时，才认为请求成功
      return parsed.result;
    } catch (error: unknown) {
      // 捕获 fetch 本身的网络错误或其他意外异常
      if (error instanceof TelegramError) {
        // 如果是已经处理过的 TelegramError，直接重新抛出
        throw error;
      }
      Log.error(`Error sending request to ${apiMethod}`, {
        apiMethod,
        err: error as Error,
        customError: new TelegramError(
          `Network error sending request to ${apiMethod}: ${error instanceof Error ? error.message : String(error)}`,
          'NETWORK_ERROR',
        ),
      });
      // 抛出统一的 TelegramError 类型
      throw new TelegramError(
        `Network error sending request to ${apiMethod}: ${error instanceof Error ? error.message : String(error)}`,
        'NETWORK_ERROR',
      );
    }
  }

  /**
   * 向指定聊天发送文本消息。
   * @param {number} chatId - 接收消息的聊天 ID。
   * @param {string} text - 要发送的文本内容。
   * @param {{replyToMessageId?: number; parseMode?: ParseMode; replyMarkup?: ReplyMarkup;}} options - 可选参数
   * @returns {Promise<{ok: boolean;messageId?: number;}>} 消息发送成功返回 `true`，否则返回 `false`。
   */
  public async sendMessage(
    chatId: number,
    text: string,
    options?: {
      replyToMessageId?: number;
      parseMode?: Bot.ParseMode;
      replyMarkup?: Bot.ReplyMarkup;
    },
  ): Promise<{ ok: true; messageId: number } | { ok: false; error: string }> {
    const payload: Bot.SendMessageParams = {
      chat_id: chatId,
      text: text,
      parse_mode: options?.parseMode,
      link_preview_options: {
        is_disabled: true,
      }, // 更现代的写法
      reply_parameters: options?.replyToMessageId
        ? {
            message_id: options?.replyToMessageId,
            allow_sending_without_reply: true,
          }
        : undefined,
      reply_markup: options?.replyMarkup ? JSON.stringify(options.replyMarkup) : undefined,
    };
    try {
      const result = await this.sendRequest<Bot.SendMessageParams, Bot.SendMessageResult>('POST', 'sendMessage', payload);
      Log.info('Telegram message sent successfully.', {
        chatId,
        messageId: result.message_id,
      });
      return {
        ok: true,
        messageId: result.message_id,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof TelegramError ? error.message : String(error);
      Log.error('Error sending Telegram message', {
        err: errorMessage,
        chatId,
        text: text.substring(0, 20) + '...',
      });
      return {
        ok: false,
        error: errorMessage,
      };
    }
  }

  /**
   * @param chatId
   * @param photoBuffer
   * @param caption
   * @param parseMode
   * @param replyToMessageId
   * @param isFormat
   */
  public async sendPhoto(
    chatId: number | string,
    photoBuffer: Buffer,
    options?: {
      caption?: string;
      replyToMessageId?: number;
      replyMarkup?: Bot.ReplyMarkup;
    },
  ): Promise<{ ok: true; messageId: number } | { ok: false; error: string }> {
    const shorten = `<blockquote expandable>${escaper.html(shortenString(String(options?.caption)))}</blockquote>`;
    const payload: Bot.SendPhotoParams = {
      chat_id: chatId,
      photo: photoBuffer,
      caption: shorten,
      parse_mode: 'HTML',
      show_caption_above_media: true,
      reply_parameters: options?.replyToMessageId
        ? {
            message_id: options.replyToMessageId,
            allow_sending_without_reply: true,
          }
        : undefined,
      reply_markup: options?.replyMarkup ? JSON.stringify(options.replyMarkup) : undefined,
    };
    const photoBlob = new Blob([payload.photo], { type: 'image/png' });
    const formData = new FormData();
    formData.append('chat_id', payload.chat_id);
    formData.append('photo', photoBlob, `gemini_gen_img.png`);
    formData.append('caption', payload.caption);
    formData.append('parse_mode', payload.parse_mode);
    formData.append('show_caption_above_media', String(payload.show_caption_above_media));
    formData.append('reply_parameters', JSON.stringify(payload.reply_parameters));
    formData.append('reply_markup', payload.reply_markup);

    try {
      const result = await this.sendRequest<FormData, Bot.SendPhotoResult>('POST', 'sendPhoto', formData, true);
      Log.info('Telegram photo message sent successfully.', {
        chatId,
        messageId: result.message_id,
      });
      return {
        ok: true,
        messageId: result.message_id,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof TelegramError ? error.message : String(error);
      Log.error('Error sending Telegram photo message', {
        err: errorMessage,
        chatId,
      });
      return {
        ok: false,
        error: errorMessage,
      };
    }
  }

  public async sendVoice(
    chatId: number | string,
    voiceBuffer: Buffer,
    options?: {
      caption?: string;
      replyToMessageId?: number;
      replyMarkup?: Bot.ReplyMarkup;
    },
  ): Promise<{ ok: true; messageId: number } | { ok: false; error: string }> {
    const payload: Bot.SendVoiceParams = {
      chat_id: chatId,
      voice: voiceBuffer,
      caption: options?.caption,
      reply_parameters: options?.replyToMessageId
        ? {
            message_id: options.replyToMessageId,
            allow_sending_without_reply: true,
          }
        : undefined,
      reply_markup: options?.replyMarkup ? JSON.stringify(options.replyMarkup) : undefined,
    };
    const voiceBlob = new Blob([payload.voice], { type: 'audio/mpeg' });
    const formData = new FormData();
    formData.append('chat_id', payload.chat_id);
    formData.append('voice', voiceBlob, `gemini_gen_voice.mp3`);
    if (payload.caption) formData.append('caption', payload.caption);
    formData.append('reply_parameters', JSON.stringify(payload.reply_parameters));
    formData.append('reply_markup', payload.reply_markup);
    try {
      const result = await this.sendRequest<FormData, Bot.SendVoiceResult>('POST', 'sendVoice', formData, true);
      Log.info('Telegram voice message sent successfully.', {
        chatId,
        messageId: result.message_id,
      });
      return {
        ok: true,
        messageId: result.message_id,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof TelegramError ? error.message : String(error);
      Log.error('Error sending Telegram voice message', {
        err: errorMessage,
        chatId,
      });
      return {
        ok: false,
        error: errorMessage,
      };
    }
  }

  /**
   * 编辑已发送的文本消息。
   * @param {number} chatId - 聊天 ID。
   * @param {number} messageId - 要编辑的消息 ID。
   * @param {string} text - 新的文本内容。
   * @returns {Promise<{ ok: boolean; messageId?: number }>} 消息编辑成功返回 `true`，否则返回 `false`。
   */
  public async editMessageText(
    chatId: number | string,
    messageId: number,
    text: string,
    options?: {
      parseMode?: Bot.ParseMode;
      entities?: Bot.MessageEntity[];
      replyMarkup?: Bot.ReplyMarkup;
    },
  ): Promise<{ ok: true; messageId: number } | { ok: false; error: string }> {
    const payload: Bot.EditMessageTextParams = {
      chat_id: chatId,
      message_id: messageId,
      text: text,
      ...(options?.parseMode ? { parse_mode: options.parseMode } : options?.entities ? { entities: JSON.stringify(options.entities) } : {}),
      link_preview_options: {
        is_disabled: true,
      },
      reply_markup: options?.replyMarkup ? JSON.stringify(options.replyMarkup) : undefined,
    };
    try {
      const result = await this.sendRequest<Bot.EditMessageTextParams, Bot.EditMessageTextResult>('POST', 'editMessageText', payload);
      Log.info('Telegram message edited successfully.', {
        chatId,
        messageId: result.message_id,
      });
      return { ok: true, messageId: result.message_id };
    } catch (error: unknown) {
      const errorMessage = error instanceof TelegramError ? error.message : String(error);
      Log.error('Error editing Telegram message', {
        err: errorMessage,
        chatId,
        messageId,
        text: text.substring(0, 20) + '...',
      });
      return { ok: false, error: errorMessage };
    }
  }

  public async editMessageReplyMarkup(
    chatId: number | string,
    messageId: number,
    replyMarkup: Bot.ReplyMarkup,
  ): Promise<{ ok: true; messageId: number } | { ok: false; error: string }> {
    const payload: Bot.EditMessageReplyMarkupParams = {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: JSON.stringify(replyMarkup),
    };
    try {
      const result = await this.sendRequest<Bot.EditMessageReplyMarkupParams, Bot.EditMessageReplyMarkupResult>(
        'POST',
        'editMessageReplyMarkup',
        payload,
      );
      Log.info('Telegram message reply markup edited successfully.', {
        chatId,
        messageId: result.message_id,
      });
      return { ok: true, messageId: result.message_id };
    } catch (error: unknown) {
      const errorMessage = error instanceof TelegramError ? error.message : String(error);
      Log.error('Error editing Telegram message reply markup', {
        err: errorMessage,
        chatId,
        messageId,
      });
      return { ok: false, error: errorMessage };
    }
  }

  /**
   * 删除指定聊天中的消息。
   * @param {number} chatId - 聊天ID。
   * @param {number} messageId - 消息ID。
   * @returns {Promise<{ ok: boolean }>} 成功返回 `{ ok: true }`，失败返回 `{ ok: false }`。
   */
  public async deleteMessage(chatId: number | string, messageId: number): Promise<{ ok: true } | { ok: false; error: string }> {
    const payload: Bot.DeleteMessageParams = {
      chat_id: chatId,
      message_id: messageId,
    };
    try {
      await this.sendRequest<Bot.DeleteMessageParams, Bot.DeleteMessageResult>('POST', 'deleteMessage', payload);
      Log.info('Telegram message deleted successfully.', { chatId, messageId });
      return { ok: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof TelegramError ? error.message : String(error);
      Log.error('Error deleting Telegram message', {
        err: errorMessage,
        chatId,
        messageId,
      });
      return { ok: false, error: errorMessage };
    }
  }

  /**
   * 删除指定聊天中的消息。
   * @param {number} chatId - 聊天ID。
   * @param {number[]} messageIds - 消息ID列表
   * @returns {Promise<{ ok: boolean }>} 成功返回 `{ ok: true }`，失败返回 `{ ok: false }`。
   */
  public async deleteMessages(chatId: number | string, messageIds: number[]): Promise<{ ok: true } | { ok: false; error: string }> {
    const payload: Bot.DeleteMessagesParams = {
      chat_id: chatId,
      message_ids: messageIds,
    };
    try {
      await this.sendRequest<Bot.DeleteMessagesParams, Bot.DeleteMessageResult>('POST', 'deleteMessages', payload);
      Log.info('Telegram message deleted successfully.', { chatId, messageIds });
      return { ok: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof TelegramError ? error.message : String(error);
      Log.error('Error deleting Telegram message', {
        err: errorMessage,
        chatId,
        messageIds,
      });
      return { ok: false, error: errorMessage };
    }
  }

  /**
   * 设置 Bot 命令列表。
   * @param {number} chatId - 聊天 ID，用于指定命令范围。
   * @returns {Promise<{ ok: boolean }>} 成功返回 `{ ok: true }`，否则返回 `{ ok: false }`。
   */
  public async setBotCommands(chatId: number | string, userId: number): Promise<{ ok: true } | { ok: false; error: string }> {
    const payload: Bot.SetBotCommandParams = {
      commands: BotCommands.map((command) => ({
        command: command.name,
        description: command.description,
      })),
      scope: {
        type: 'chat_member',
        chat_id: chatId,
        user_id: userId,
      },
    };
    try {
      await this.sendRequest<Bot.SetBotCommandParams, Bot.SetBotCommandResult>('POST', 'setMyCommands', payload);
      Log.info('Bot commands set successfully.', { chatId });
      return { ok: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof TelegramError ? error.message : String(error);
      Log.error('Error setting bot commands', { err: errorMessage });
      return { ok: false, error: errorMessage };
    }
  }

  /**
   * 获取文件信息，包括文件路径。
   * @param {string} fileId - 文件的唯一 ID。
   * @returns {Promise<{ ok: true; data: Bot.File } | { ok: false; error: string }>} 文件信息对象，如果获取失败则返回 `undefined`。
   */
  public async getFile(fileId: string): Promise<{ ok: true; data: Bot.File } | { ok: false; error: string }> {
    Log.info(`Getting file info for file_id: ${fileId}`);
    try {
      const result = await this.sendRequest<Bot.GetFileParams, Bot.GetFileResult>('POST', 'getFile', {
        file_id: fileId,
      });
      return { ok: true, data: result };
    } catch (error: unknown) {
      const errorMessage = error instanceof TelegramError ? error.message : String(error);
      Log.error(`Error in getFile for file_id ${fileId}`, {
        err: errorMessage,
        fileId,
      });
      return { ok: false, error: errorMessage };
    }
  }

  /**
   * 获取指定聊天成员的信息。
   * @param {number} chatId - 聊天 ID。
   * @param {number} userId - 用户 ID。
   * @returns {Promise<GetChatMemberResult>} 聊天成员信息对象。
   */
  public async getChatMember(
    chatId: number | string,
    userId: number,
  ): Promise<{ ok: true; data: Bot.GetChatMemberResult } | { ok: false; error: string }> {
    // Log.info(`Getting chat member info for chat_id: ${chatId}, user_id: ${userId}`);
    const payload: Bot.GetChatMemberParams = {
      chat_id: chatId,
      user_id: userId,
    };
    try {
      const result = await this.sendRequest<Bot.GetChatMemberParams, Bot.GetChatMemberResult>('POST', 'getChatMember', payload);
      return { ok: true, data: result };
    } catch (error: unknown) {
      const errorMessage = error instanceof TelegramError ? error.message : String(error);
      Log.error(`Error in getChatMember for chat_id ${chatId}, user_id ${userId}`, {
        err: errorMessage,
        chatId,
        userId,
      });
      return { ok: false, error: errorMessage };
    }
  }

  public async answerCallbackQuery(
    callbackQueryId: string,
    options?: {
      callbackText?: string;
      showAlert?: boolean;
    },
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const payload: Bot.AnswerCallbackQueryParams = {
      callback_query_id: callbackQueryId,
      text: options?.callbackText,
      show_alert: options?.showAlert,
    };
    try {
      await this.sendRequest<Bot.AnswerCallbackQueryParams, Bot.AnswerCallbackQueryResult>('POST', 'answerCallbackQuery', payload);
      Log.info('Callback query answered successfully.', { callbackQueryId, callbackText: options?.callbackText });
      return { ok: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof TelegramError ? error.message : String(error);
      Log.error('Error answering callback query', {
        err: errorMessage,
        callbackQueryId,
        callbackText: options?.callbackText,
      });
      return { ok: false, error: errorMessage };
    }
  }

  public async answerInlineQuery(
    inlineQueryId: string,
    inlineResult: Bot.InlineQueryResult[],
    options?: {
      cacheTime?: number;
      isPersonal?: boolean;
      nextOffset?: string;
      button?: Bot.InlineQueryResultsButton;
    },
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const payload: Bot.AnswerInlineQueryParams = {
      inline_query_id: inlineQueryId,
      results: JSON.stringify(inlineResult),
      cache_time: options?.cacheTime,
      is_personal: options?.isPersonal,
      next_offset: options?.nextOffset,
      button: options?.button ? JSON.stringify(options.button) : undefined,
    };
    try {
      await this.sendRequest<Bot.AnswerInlineQueryParams, Bot.AnswerInlineQueryResult>('POST', 'answerInlineQuery', payload);
      Log.info('Inline query answered successfully.', { inlineQueryId });
      return { ok: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof TelegramError ? error.message : String(error);
      Log.error('Error answering inline query', {
        err: errorMessage,
        inlineQueryId,
      });
      return { ok: false, error: errorMessage };
    }
  }
}

export const bot: TelegramBot = new TelegramBot();

export const REACTiON_ROW: Bot.InlineKeyboardButton[] = [
  {
    text: '👍',
    callback_data: 'reaction_like',
  },
  {
    text: '👎',
    callback_data: 'reaction_dislike',
  },
];

const DELETE_ROW: Bot.InlineKeyboardButton[] = [
  {
    text: '🗑 删除消息',
    callback_data: 'delete_message_USER_ID',
  },
];

export const BASE_INLINE_KEYBOARD: Bot.InlineKeyboardButton[][] = [REACTiON_ROW, DELETE_ROW];

export const makeInlineKeyboard = (userId: number): Bot.InlineKeyboardButton[][] => {
  return BASE_INLINE_KEYBOARD.map((row) =>
    row.map((button) => {
      if (button.callback_data?.includes('USER_ID')) {
        return {
          ...button,
          callback_data: button.callback_data.replace('USER_ID', String(userId)),
        };
      } else {
        return button;
      }
    }),
  );
};
