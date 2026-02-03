import { TELEGRAM_BASE_URL } from '@shared/core/constants';
import { logger } from '@shared/core/logger';
import type { Recordable } from '@shared/types/common';
import type { RequestResult } from '@shared/types/http';
import type {
  ApiErrorResult,
  ApiMethod,
  ApiParams,
  ApiResult,
  ApiReturn,
  AutoDeleteParams,
  ChatId,
  CustomReplyParams,
  Integer,
} from '@shared/types/telegram';
import type { Evaluate } from '@shared/types/utils';
import { shortenString } from '@shared/utils/helpers';
import { httpRequest } from '@shared/utils/http';
import { Escaper } from '@telegram/markdown/Escaper';
import type {
  ApiResponse,
  BotCommand,
  InlineKeyboardMarkup,
  InlineQueryResult,
  InputFile,
  InputMediaDocument,
  Message,
  ReactionTypeEmoji,
} from 'grammy/types';

type CustomParams = CustomReplyParams & AutoDeleteParams;

type MethodExtraParams<M extends ApiMethod> = (M extends `send${string}` ? CustomParams : unknown) &
  (M extends 'sendMediaGroup' ? Pick<InputMediaDocument, 'caption' | 'parse_mode'> : unknown) &
  (M extends `edit${string}` ? AutoDeleteParams : unknown);

type ExtractParamOptions<M extends ApiMethod, X extends keyof ApiParams<M> & string = never> = Evaluate<
  Omit<ApiParams<M>, X | 'reply_parameters' | 'reply_to_message_id'> & MethodExtraParams<M>
>;

type MessageIdProperty = Pick<Message, 'message_id'>;

interface IScheduler {
  schedule: <M extends ApiMethod>(action: M, params: ApiParams<M>, delayMs: number) => void;
}

const isMessageIdProperty = (data: unknown): data is MessageIdProperty => {
  return typeof data === 'object' && data !== null && 'message_id' in data && typeof data.message_id === 'number';
};

export class TelegramBotApi {
  private readonly token: string;
  private scheduler: IScheduler | undefined;

  constructor(token: string) {
    this.token = token;
  }

  public setScheduler(s: IScheduler) {
    this.scheduler = s;
  }

  public setWebhook(url: string, opts?: ExtractParamOptions<'setWebhook', 'url'>): Promise<ApiResult<'setWebhook'>> {
    return this.requestJson('setWebhook', { ...this.buildOptionalParams(opts), url, drop_pending_updates: true }, url);
  }

  public deleteWebhook(): Promise<ApiResult<'deleteWebhook'>> {
    return this.requestJson('deleteWebhook', { drop_pending_updates: true });
  }

  public async sendMessage(
    chat_id: ChatId,
    text: string,
    opts?: ExtractParamOptions<'sendMessage', 'chat_id' | 'text'>,
  ): Promise<ApiResult<'sendMessage'>> {
    const res = await this.requestJson(
      'sendMessage',
      {
        ...this.buildOptionalParams(opts),
        chat_id,
        text,
        link_preview_options: { is_disabled: true },
      },
      shortenString(text),
    );

    return this.processMessageResult(res, chat_id, opts?.deleteAfterMs);
  }

  public async sendPhoto(
    chat_id: ChatId,
    file: File,
    opts?: ExtractParamOptions<'sendPhoto', 'chat_id' | 'photo'>,
  ): Promise<ApiResult<'sendPhoto'>> {
    const res = await this.requestJson(
      'sendPhoto',
      {
        ...this.buildOptionalParams(opts),
        chat_id,
        photo: this.createInputFile(file),
        show_caption_above_media: true,
      },
      opts?.caption,
    );

    return this.processMessageResult(res, chat_id, opts?.deleteAfterMs);
  }

  public async sendVoice(
    chat_id: ChatId,
    file: File,
    opts?: ExtractParamOptions<'sendVoice', 'chat_id' | 'voice'>,
  ): Promise<ApiResult<'sendVoice'>> {
    const res = await this.requestJson(
      'sendVoice',
      {
        ...this.buildOptionalParams(opts),
        chat_id,
        voice: this.createInputFile(file),
      },
      opts?.caption,
    );

    return this.processMessageResult(res, chat_id, opts?.deleteAfterMs);
  }

  public async sendDocument(
    chat_id: ChatId,
    file: File,
    opts?: ExtractParamOptions<'sendDocument', 'chat_id' | 'document'>,
  ): Promise<ApiResult<'sendDocument'>> {
    const res = await this.requestJson(
      'sendDocument',
      {
        ...this.buildOptionalParams(opts),
        chat_id,
        document: this.createInputFile(file),
      },
      opts?.caption,
    );

    return this.processMessageResult(res, chat_id, opts?.deleteAfterMs);
  }

  public async sendMediaGroup(
    chat_id: ChatId,
    files: File[],
    opts?: ExtractParamOptions<'sendMediaGroup', 'chat_id' | 'media'>,
  ): Promise<ApiResult<'sendMediaGroup'>> {
    const { caption, parse_mode, ...rest } = opts ?? {};
    const formData = new FormData();
    const mediaGroup = files.map<InputMediaDocument>((file, i) => {
      const attachName = `attach_${i}`;
      formData.append(attachName, file, file.name);
      return {
        type: 'document',
        media: `attach://${attachName}`,
        ...(i === 0 && {
          ...this.buildCaptionParams(caption),
          ...(parse_mode && { parse_mode: parse_mode }),
        }),
      };
    });
    const params: ApiParams<'sendMediaGroup'> = {
      ...this.buildOptionalParams(rest),
      chat_id,
      media: mediaGroup,
    };
    const finalFormData = this.makeFormData(params, formData);
    const res = await this.requestJson('sendMediaGroup', finalFormData, caption);

    return this.processMessageResult(res, chat_id, opts?.deleteAfterMs);
  }

  public async editMessageText(
    chat_id: ChatId,
    message_id: Integer,
    text: string,
    opts?: ExtractParamOptions<'editMessageText', 'chat_id' | 'message_id' | 'text'>,
  ): Promise<ApiResult<'editMessageText'>> {
    const res = await this.requestJson(
      'editMessageText',
      {
        ...this.buildOptionalParams(opts),
        chat_id,
        message_id,
        text,
        link_preview_options: { is_disabled: true },
      },
      shortenString(text),
    );

    return this.processMessageResult(res, chat_id, opts?.deleteAfterMs);
  }

  public async editMessageReplyMarkup(
    chat_id: ChatId,
    message_id: Integer,
    reply_markup: InlineKeyboardMarkup,
    opts?: ExtractParamOptions<'editMessageReplyMarkup', 'chat_id' | 'message_id' | 'reply_markup'>,
  ): Promise<ApiResult<'editMessageReplyMarkup'>> {
    const res = await this.requestJson(
      'editMessageReplyMarkup',
      {
        ...this.buildOptionalParams(opts),
        chat_id,
        message_id,
        reply_markup,
      },
      'Edit Markup',
    );

    return this.processMessageResult(res, chat_id, opts?.deleteAfterMs);
  }

  public deleteMessage(chat_id: ChatId, message_id: Integer): Promise<ApiResult<'deleteMessage'>> {
    return this.requestJson('deleteMessage', { chat_id, message_id }, String(message_id));
  }

  public deleteMessages(chat_id: ChatId, message_ids: Integer[]): Promise<ApiResult<'deleteMessages'>> {
    return this.requestJson('deleteMessages', { chat_id, message_ids }, `${message_ids.length} msgs`);
  }

  public setMessageReaction(
    chat_id: ChatId,
    message_id: Integer,
    emoji: ReactionTypeEmoji['emoji'],
  ): Promise<ApiResult<'setMessageReaction'>> {
    return this.requestJson('setMessageReaction', { chat_id, message_id, reaction: [{ type: 'emoji', emoji }] }, emoji);
  }

  public setBotCommands(
    commands: BotCommand[],
    chat_id: ChatId,
    user_id: Integer,
  ): Promise<ApiResult<'setMyCommands'>> {
    return this.requestJson(
      'setMyCommands',
      {
        commands,
        scope: { type: 'chat_member', chat_id, user_id },
      },
      JSON.stringify(commands),
    );
  }

  public getFile(file_id: string): Promise<ApiResult<'getFile'>> {
    return this.requestJson('getFile', { file_id }, file_id);
  }

  public getChatMember(chat_id: ChatId, user_id: Integer): Promise<ApiResult<'getChatMember'>> {
    return this.requestJson('getChatMember', { chat_id, user_id }, String(user_id));
  }

  public answerCallbackQuery(
    callback_query_id: string,
    opts?: ExtractParamOptions<'answerCallbackQuery', 'callback_query_id'>,
  ): Promise<ApiResult<'answerCallbackQuery'>> {
    return this.requestJson(
      'answerCallbackQuery',
      {
        ...this.buildOptionalParams(opts),
        callback_query_id,
      },
      callback_query_id,
    );
  }

  public answerInlineQuery(
    inline_query_id: string,
    results: InlineQueryResult[],
    opts?: ExtractParamOptions<'answerInlineQuery', 'inline_query_id' | 'results'>,
  ): Promise<ApiResult<'answerInlineQuery'>> {
    return this.requestJson(
      'answerInlineQuery',
      {
        ...this.buildOptionalParams(opts),
        inline_query_id,
        results,
      },
      inline_query_id,
    );
  }

  public leaveChat(chat_id: ChatId): Promise<ApiResult<'leaveChat'>> {
    return this.requestJson('leaveChat', { chat_id }, String(chat_id));
  }

  public async requestJson<M extends ApiMethod>(
    method: M,
    params: ApiParams<M> | FormData,
    ...context: (string | undefined)[]
  ): Promise<ApiResult<M>> {
    logger.info(`[Telegram API] ${method} calling...`);
    logger.debug(`[Telegram API] ${method} params:`, { params });
    try {
      const res = await this.request(method, params!);
      const result = res.data as unknown as ApiResponse<ApiReturn<M>>;
      if (!result.ok) {
        const desc = `${result.error_code} - ${result.description}`;
        return this.handleError(desc, method, [JSON.stringify(result.parameters)]);
      }
      logger.debug(`[Telegram API] ${method} result:`, { result });
      return { ok: true, data: result.result };
    } catch (err) {
      return this.handleError(err, method, context);
    }
  }

  private generateApiUrl(method: ApiMethod): string {
    return `${TELEGRAM_BASE_URL}/bot${this.token}/${method}`;
  }

  private request(method: ApiMethod, params: Recordable | FormData): Promise<RequestResult<'json'>> {
    const apiUrl = this.generateApiUrl(method);
    if (params instanceof FormData) {
      return this.formDataRequest(apiUrl, params);
    }
    for (const value of Object.values(params)) {
      if (value instanceof File || value instanceof Blob) {
        const formData = this.makeFormData(params);
        return this.formDataRequest(apiUrl, formData);
      }
    }
    return this.jsonRequest(apiUrl, params);
  }

  private jsonRequest(url: string, params: Recordable) {
    return httpRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
      responseType: 'json',
    });
  }

  private formDataRequest(url: string, formData: FormData) {
    return httpRequest(url, {
      method: 'POST',
      body: formData,
      responseType: 'json',
    });
  }

  private makeFormData(params: Recordable, formData: FormData = new FormData()): FormData {
    for (const [key, value] of Object.entries(params)) {
      if (value instanceof File) {
        formData.append(key, value, value.name);
      } else if (value instanceof Blob) {
        formData.append(key, value, 'blob');
      } else if (typeof value === 'string') {
        formData.append(key, value);
      } else {
        formData.append(key, JSON.stringify(value));
      }
    }
    return formData;
  }

  /**
   * Standardized handler for message API results.
   * Handles extraction of message IDs and delegates auto-deletion logic.
   */
  private processMessageResult<T extends ApiMethod>(
    res: ApiResult<T>,
    chat_id: ChatId,
    deleteAfterMs?: number,
  ): ApiResult<T> {
    if (!res.ok) return res;
    if (!this.scheduler) {
      logger.warn('Scheduler is not set.');
      return res;
    }

    // Normalize data: boolean -> msgId (if applicable), object -> msgId, array -> msgIds
    const data = res.data;
    let messageIdsToDelete: Integer[] = [];

    if (Array.isArray(data)) {
      const ids: Integer[] = data
        .map((item) => (isMessageIdProperty(item) ? item.message_id : null))
        .filter((id): id is Integer => id !== null);

      messageIdsToDelete = ids;
    } else if (isMessageIdProperty(data)) {
      messageIdsToDelete = [data.message_id];
    }

    if (deleteAfterMs && messageIdsToDelete.length > 0) {
      this.scheduler.schedule('deleteMessages', { chat_id, message_ids: messageIdsToDelete }, deleteAfterMs);
    }

    return res;
  }

  private createInputFile(file: File): InputFile {
    return file as unknown as InputFile;
  }

  private buildCaptionParams(caption?: string): Pick<ApiParams<'sendDocument'>, 'caption' | 'parse_mode'> {
    if (!caption) return {};
    const escaped = Escaper.html(shortenString(caption));
    return { caption: `<blockquote expandable>${escaped}</blockquote>`, parse_mode: 'HTML' };
  }

  private buildReplyParams(replyToMessageId?: number): Pick<ApiParams<'sendMessage'>, 'reply_parameters'> {
    if (!replyToMessageId) return {};
    return {
      reply_parameters: {
        message_id: replyToMessageId,
        allow_sending_without_reply: true,
      },
    };
  }

  /**
   * Constructs common optional parameters.
   * Returns a partial object that strictly matches Telegram's snake_case expectations.
   */
  private buildOptionalParams<M extends ApiMethod, X extends keyof ApiParams<M> & string = never>(
    opts?: ExtractParamOptions<M, X>,
  ): Omit<ApiParams<M>, X> {
    const {
      replyToMessageId,
      caption,
      deleteAfterMs: _rm,
      ...rest
    } = (opts ?? {}) as CustomParams & Pick<ApiParams<'sendDocument'>, 'caption' | 'parse_mode'>;

    return {
      ...rest,
      ...this.buildReplyParams(replyToMessageId),
      ...this.buildCaptionParams(caption),
    } as Omit<ApiParams<M>, X>;
  }

  private handleError(err: unknown, method: string, context?: (string | undefined)[]): ApiErrorResult {
    const errMsg = err instanceof Error ? err.message : typeof err === 'string' ? err : 'unknown error';
    const contextInfo = context && context.length > 0 ? context.filter(Boolean).join('\n') : 'N/A';
    logger.warn(`Failed to call Telegram API [${method}]: ${errMsg}`, {
      err,
      context: contextInfo,
    });
    return { ok: false, error: errMsg };
  }
}
