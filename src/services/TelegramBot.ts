// src/services/TelegramBot.ts

import { config, logger } from '@/services';
import type { HttpMethod } from '@/types';
import type * as Bot from '@/types/telegram';
import { shortenString } from '@/utils';
import { AppError } from '@/utils/errors';
import { escaper } from '@/utils/formatters';

interface ErrorResult {
  ok: false;
  error: string;
}

interface MessageProps {
  messageId: number;
}

interface MessagesProps {
  messageIds: number[];
}

interface FileProps {
  data: Bot.TFile;
}

interface ChatMemberProps {
  data: Bot.ChatMember;
}

type MethodResult<T = void> = (T extends void ? { ok: true } : T & { ok: true }) | ErrorResult;

/**
 * @description 封装与 Telegram Bot API 的交互逻辑。
 */
class TelegramBot {
  private readonly apiUrl: string;

  constructor() {
    this.apiUrl = config.botApiUrl;
  }

  /**
   * 发送 API 请求的通用方法。
   */
  private async makeRequest<T>(httpMethod: HttpMethod, apiMethod: Bot.ApiMethod, body: object | FormData): Promise<T> {
    const url = `${this.apiUrl}/${apiMethod}`;
    let requestBody: string | FormData | undefined;
    let headers: RequestInit['headers'] | undefined;

    if (body instanceof FormData) {
      requestBody = body;
    } else {
      requestBody = JSON.stringify(body);
      headers = {
        'Content-Type': 'application/json',
      };
    }

    try {
      const response = await fetch(url, {
        method: String(httpMethod).toUpperCase(),
        headers,
        body: requestBody,
      });

      const parsed = (await response.json()) as Bot.ApiResponse<T>;

      if (!parsed.ok) {
        const desc = parsed.description;
        const errCode = `API_FAILED_${String(apiMethod).toUpperCase()}_${parsed.error_code}`;
        logger.error(`Telegram API request failed for ${apiMethod}`, {
          apiMethod,
          statusCode: response.status,
          responseBody: parsed,
        });
        throw new AppError(`Telegram API error: ${desc}`, errCode);
      }

      if (!response.ok) {
        const desc = `HTTP request failed with status: ${response.status}`;
        logger.error(`HTTP error for ${apiMethod}`, { statusCode: response.status });
        throw new AppError(desc, `HTTP_ERROR_${response.status}`);
      }

      return parsed.result;
    } catch (err) {
      if (err instanceof AppError) throw err;
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error(`Network error sending request to ${apiMethod}`, { err });
      throw new AppError(`Network error sending request to ${apiMethod}: ${errMsg}`, 'NETWORK_ERROR');
    }
  }

  /**
   * 辅助方法：将复杂对象字段添加到 FormData 时进行 JSON 序列化
   */
  private appendToFormData<T>(formData: FormData, key: string, value: T): void {
    if (value === undefined || value === null) return;
    if (typeof value === 'object' && !(value instanceof File) && !(value instanceof Blob)) {
      formData.append(key, JSON.stringify(value));
    } else {
      formData.append(key, String(value));
    }
  }

  /**
   * 辅助方法：安全地序列化可选对象字段，用于 JSON Payload
   * 如果 value 存在，返回 JSON 字符串；否则返回 undefined
   */
  private stringifyField<T>(value: T): string | undefined {
    return value ? JSON.stringify(value) : undefined;
  }

  public async setWebhook(url: string, secretToken: string): Promise<MethodResult> {
    const payload: Bot.SetWebhookParams = {
      url: url,
      secret_token: secretToken,
      drop_pending_updates: true,
    };

    try {
      await this.makeRequest<boolean>('POST', 'setWebhook', payload);
      logger.info('Telegram webhook set successfully.', { url });
      return { ok: true };
    } catch (error) {
      return this.handleError(error, 'unknown', 'setWebhook', url);
    }
  }

  public async deleteWebhook(): Promise<MethodResult> {
    try {
      await this.makeRequest<boolean>('POST', 'deleteWebhook', { drop_pending_updates: true });
      logger.info('Telegram webhook deleted successfully.');
      return { ok: true };
    } catch (error) {
      return this.handleError(error, 'unknown', 'deleteWebhook');
    }
  }

  /**
   * 向指定聊天发送文本消息。
   */
  public async sendMessage(
    chatId: Bot.ChatId,
    text: string,
    options?: {
      replyToMessageId?: number;
      parseMode?: Bot.ParseMode;
      replyMarkup?: Bot.ReplyMarkup;
    },
  ): Promise<MethodResult<MessageProps>> {
    const payload: Bot.SendMessageParams = {
      chat_id: chatId,
      text: text,
      parse_mode: options?.parseMode,
      link_preview_options: {
        is_disabled: true,
      },
      reply_parameters: options?.replyToMessageId
        ? {
            message_id: options?.replyToMessageId,
            allow_sending_without_reply: true,
          }
        : undefined,
      reply_markup: this.stringifyField(options?.replyMarkup),
    };
    try {
      const result = await this.makeRequest<Bot.Message>('POST', 'sendMessage', payload);
      logger.info('Telegram message sent successfully.', {
        chatId,
        messageId: result.message_id,
      });
      return {
        ok: true,
        messageId: result.message_id,
      };
    } catch (error) {
      return this.handleError(error, chatId, 'sendMessage', text);
    }
  }

  public async sendPhoto(
    chatId: Bot.ChatId,
    photoFile: File,
    options?: {
      caption?: string;
      replyToMessageId?: number;
      replyMarkup?: Bot.ReplyMarkup;
    },
  ): Promise<MethodResult<MessageProps>> {
    const shorten = `<blockquote expandable>${escaper.html(shortenString(String(options?.caption || '')))}</blockquote>`;
    const params: Bot.SendPhotoParams = {
      chat_id: chatId,
      photo: photoFile,
      caption: options?.caption ? shorten : undefined,
      parse_mode: 'HTML',
      show_caption_above_media: true,
      reply_parameters: options?.replyToMessageId
        ? {
            message_id: options.replyToMessageId,
            allow_sending_without_reply: true,
          }
        : undefined,
      reply_markup: this.stringifyField(options?.replyMarkup),
    };
    const formData = new FormData();
    formData.append('chat_id', String(params.chat_id));
    formData.append('photo', params.photo);
    formData.append('reply_markup', params.reply_markup);

    this.appendToFormData(formData, 'caption', params.caption);
    this.appendToFormData(formData, 'parse_mode', params.parse_mode);
    this.appendToFormData(formData, 'show_caption_above_media', params.show_caption_above_media);
    this.appendToFormData(formData, 'reply_parameters', params.reply_parameters);

    try {
      const result = await this.makeRequest<Bot.Message>('POST', 'sendPhoto', formData);
      logger.info('Telegram photo sent successfully.', { chatId, messageId: result.message_id });
      return { ok: true, messageId: result.message_id };
    } catch (error) {
      return this.handleError(error, chatId, 'sendPhoto');
    }
  }

  public async sendVoice(
    chatId: Bot.ChatId,
    voiceFile: File,
    options?: {
      caption?: string;
      replyToMessageId?: number;
      replyMarkup?: Bot.ReplyMarkup;
    },
  ): Promise<MethodResult<MessageProps>> {
    const params: Bot.SendVoiceParams = {
      chat_id: chatId,
      voice: voiceFile,
      caption: options?.caption,
      reply_parameters: options?.replyToMessageId
        ? { message_id: options.replyToMessageId, allow_sending_without_reply: true }
        : undefined,
      reply_markup: this.stringifyField(options?.replyMarkup),
    };
    const formData = new FormData();
    formData.append('chat_id', String(params.chat_id));
    formData.append('voice', params.voice);
    formData.append('reply_markup', params.reply_markup);

    this.appendToFormData(formData, 'caption', params.caption);
    this.appendToFormData(formData, 'reply_parameters', params.reply_parameters);
    try {
      const result = await this.makeRequest<Bot.Message>('POST', 'sendVoice', formData);
      logger.info('Telegram voice message sent successfully.', {
        chatId,
        messageId: result.message_id,
      });
      return {
        ok: true,
        messageId: result.message_id,
      };
    } catch (error) {
      return this.handleError(error, chatId, 'sendVoice');
    }
  }

  public async sendDocument(
    chatId: Bot.ChatId,
    documentFile: File,
    options?: {
      caption?: string;
      replyToMessageId?: number;
      replyMarkup?: Bot.ReplyMarkup;
    },
  ): Promise<MethodResult<MessageProps>> {
    const params: Bot.SendDocumentParams = {
      chat_id: chatId,
      document: documentFile,
      caption: options?.caption,
      parse_mode: 'HTML',
      reply_parameters: options?.replyToMessageId
        ? { message_id: options.replyToMessageId, allow_sending_without_reply: true }
        : undefined,
      reply_markup: this.stringifyField(options?.replyMarkup),
    };
    const formData = new FormData();
    formData.append('chat_id', String(params.chat_id));
    formData.append('document', params.document);
    formData.append('reply_markup', params.reply_markup);

    this.appendToFormData(formData, 'caption', params.caption);
    this.appendToFormData(formData, 'parse_mode', params.parse_mode);
    this.appendToFormData(formData, 'reply_parameters', params.reply_parameters);

    try {
      const result = await this.makeRequest<Bot.Message>('POST', 'sendDocument', formData);
      logger.info('Telegram document message sent successfully.', {
        chatId,
        messageId: result.message_id,
      });
      return {
        ok: true,
        messageId: result.message_id,
      };
    } catch (error) {
      return this.handleError(error, chatId, 'sendDocument');
    }
  }

  public async sendMediaGroup(
    chatId: Bot.ChatId,
    files: File[],
    options?: {
      caption?: string;
      replyToMessageId?: number;
    },
  ): Promise<MethodResult<MessagesProps>> {
    const formData = new FormData();
    const medias: Bot.InputMedia[] = [];
    files.forEach((file, i) => {
      const attachName = `file_${i}`;
      formData.append(attachName, file, file.name || attachName);
      const media: Bot.InputMedia = {
        type: 'document',
        media: `attach://${attachName}`,
      };
      if (i === 0 && options?.caption) {
        media.caption = options.caption;
        media.parse_mode = 'HTML';
      }
      medias.push(media);
    });

    const replyParams = options?.replyToMessageId
      ? { message_id: options.replyToMessageId, allow_sending_without_reply: true }
      : undefined;

    formData.append('chat_id', String(chatId));

    formData.append('media', JSON.stringify(medias));
    this.appendToFormData(formData, 'reply_parameters', replyParams);
    try {
      const result = await this.makeRequest<Bot.Message[]>('POST', 'sendMediaGroup', formData);
      logger.info('Telegram media group message sent successfully.', {
        chatId,
        messageIds: result.map((r) => r.message_id),
      });
      return {
        ok: true,
        messageIds: result.map((r) => r.message_id),
      };
    } catch (error) {
      return this.handleError(error, chatId, 'sendMediaGroup');
    }
  }

  /**
   * 编辑已发送的文本消息。
   */
  public async editMessageText(
    chatId: Bot.ChatId,
    messageId: number,
    text: string,
    options?: {
      parseMode?: Bot.ParseMode;
      entities?: Bot.MessageEntity[];
      replyMarkup?: Bot.InlineKeyboardMarkup;
    },
  ): Promise<MethodResult<MessageProps>> {
    const payload: Bot.EditMessageTextParams = {
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: options?.parseMode,
      // 【关键修正】 entities 和 reply_markup 手动序列化
      entities: this.stringifyField(options?.entities),
      link_preview_options: { is_disabled: true },
      reply_markup: this.stringifyField(options?.replyMarkup),
    };
    try {
      const result = await this.makeRequest<Bot.Message>('POST', 'editMessageText', payload);
      logger.info('Telegram message edited successfully.', {
        chatId,
        messageId: result.message_id,
      });
      return { ok: true, messageId: result.message_id };
    } catch (error) {
      return this.handleError(error, chatId, 'editMessageText', text);
    }
  }

  public async editMessageReplyMarkup(
    chatId: Bot.ChatId,
    messageId: number,
    replyMarkup: Bot.InlineKeyboardMarkup,
  ): Promise<MethodResult<MessageProps>> {
    const payload: Bot.EditMessageReplyMarkupParams = {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: this.stringifyField(replyMarkup),
    };
    try {
      const result = await this.makeRequest<Bot.Message>('POST', 'editMessageReplyMarkup', payload);
      logger.info('Telegram message reply markup edited successfully.', {
        chatId,
        messageId: result.message_id,
      });
      return { ok: true, messageId: result.message_id };
    } catch (error) {
      return this.handleError(error, chatId, 'editMessageReplyMarkup');
    }
  }

  /**
   * 删除指定聊天中的消息
   */
  public async deleteMessage(chatId: Bot.ChatId, messageId: number): Promise<MethodResult> {
    try {
      await this.makeRequest<boolean>('POST', 'deleteMessage', { chat_id: chatId, message_id: messageId });
      logger.info('Telegram message deleted.', { chatId, messageId });
      return { ok: true };
    } catch (error) {
      return this.handleError(error, chatId, 'deleteMessage');
    }
  }

  /**
   * 删除指定聊天中的多条消息。
   */
  public async deleteMessages(chatId: Bot.ChatId, messageIds: number[]): Promise<MethodResult> {
    try {
      await this.makeRequest<boolean>('POST', 'deleteMessages', { chat_id: chatId, message_ids: messageIds });
      logger.info('Telegram messages deleted.', { chatId, messageIds });
      return { ok: true };
    } catch (error) {
      return this.handleError(error, chatId, 'deleteMessages');
    }
  }

  /**
   * 设置 Bot 命令列表。
   */
  public async setBotCommands(chatId: Bot.ChatId, userId: number, commands: Bot.BotCommand[]): Promise<MethodResult> {
    const payload: Bot.SetBotCommandParams = {
      commands,
      scope: {
        type: 'chat_member',
        chat_id: chatId,
        user_id: userId,
      },
    };
    try {
      await this.makeRequest<boolean>('POST', 'setMyCommands', payload);
      logger.info('Bot commands set successfully.', { chatId });
      return { ok: true };
    } catch (error) {
      return this.handleError(error, chatId, 'setBotCommands');
    }
  }

  /**
   * 获取文件信息，包括文件路径
   */
  public async getFile(fileId: string): Promise<MethodResult<FileProps>> {
    try {
      const result = await this.makeRequest<Bot.TFile>('POST', 'getFile', { file_id: fileId });
      return { ok: true, data: result };
    } catch (error) {
      return this.handleError(error, 'unknown', 'getFile', fileId);
    }
  }

  /**
   * 获取指定聊天成员的信息。
   */
  public async getChatMember(chatId: Bot.ChatId, userId: number): Promise<MethodResult<ChatMemberProps>> {
    try {
      const result = await this.makeRequest<Bot.ChatMember>('POST', 'getChatMember', {
        chat_id: chatId,
        user_id: userId,
      });
      return { ok: true, data: result };
    } catch (error) {
      return this.handleError(error, chatId, 'getChatMember');
    }
  }

  public async answerCallbackQuery(
    callbackQueryId: string,
    options?: {
      callbackText?: string;
      showAlert?: boolean;
    },
  ): Promise<MethodResult> {
    const payload: Bot.AnswerCallbackQueryParams = {
      callback_query_id: callbackQueryId,
      text: options?.callbackText,
      show_alert: options?.showAlert,
    };
    try {
      await this.makeRequest<boolean>('POST', 'answerCallbackQuery', payload);
      logger.info('Callback query answered.', { callbackQueryId });
      return { ok: true };
    } catch (error) {
      return this.handleError(error, 'unknown', 'answerCallbackQuery', callbackQueryId);
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
  ): Promise<MethodResult> {
    const payload: Bot.AnswerInlineQueryParams = {
      inline_query_id: inlineQueryId,
      results: this.stringifyField(inlineResult) as string,
      cache_time: options?.cacheTime,
      is_personal: options?.isPersonal,
      next_offset: options?.nextOffset,
      button: this.stringifyField(options?.button),
    };
    try {
      await this.makeRequest<boolean>('POST', 'answerInlineQuery', payload);
      logger.info('Inline query answered.', { inlineQueryId });
      return { ok: true };
    } catch (error) {
      return this.handleError(error, 'unknown', 'answerInlineQuery', inlineQueryId);
    }
  }

  public async leaveChat(chatId: Bot.ChatId): Promise<MethodResult> {
    try {
      await this.makeRequest<boolean>('POST', 'leaveChat', { chat_id: chatId });
      logger.info('Bot left chat successfully.', { chatId });
      return { ok: true };
    } catch (error) {
      return this.handleError(error, chatId, 'leaveChat');
    }
  }

  private handleError(err: unknown, chatId: string | number, method: string, context?: string): ErrorResult {
    const errorMessage = err instanceof AppError ? err.message : String(err);
    logger.error(`Error in ${method}`, {
      err,
      chatId,
      context: context ? context.substring(0, 50) : undefined,
    });
    return { ok: false, error: errorMessage };
  }
}

export const bot = new TelegramBot();
