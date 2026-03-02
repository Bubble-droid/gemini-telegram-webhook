import type {
  ApiResponse,
  BotCommand,
  InlineKeyboardMarkup,
  InlineQueryResult,
  InputMediaDocument,
  Message,
  ReactionTypeEmoji,
} from '@grammyjs/types';
import { TELEGRAM_BASE_URL } from '@shared/core/constants.js';
import { TelegramError } from '@shared/core/errors.js';
import { logger } from '@shared/core/logger.js';
import { markdownToTelegraph } from '@shared/markdown/telegraph-converter.js';
import type { Recordable } from '@shared/types/common.js';
import type { RequestResult } from '@shared/types/http.js';
import type {
  ApiMethod,
  ApiParams,
  ApiReturn,
  AutoDeleteParams,
  ChatId,
  CustomReplyParams,
  Integer,
} from '@shared/types/telegram.js';
import type { Evaluate } from '@shared/types/utils.js';
import { httpRequest } from '@shared/utils/http.js';
import { type Account, type Telegraph } from 'telegraph-api-client';

type CustomParams = CustomReplyParams & AutoDeleteParams;

type MethodExtraParams<M extends ApiMethod> = (M extends `send${string}` ? CustomParams : unknown) &
  (M extends 'sendMediaGroup' ? Pick<InputMediaDocument<File>, 'caption' | 'parse_mode'> : unknown) &
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
  private readonly telegraph: Telegraph;
  private readonly telegraphAccount: Account;
  private scheduler: IScheduler | undefined;

  constructor(token: string, telegraph: Telegraph, telegraphAccount: Account) {
    this.token = token;
    this.telegraph = telegraph;
    this.telegraphAccount = telegraphAccount;
  }

  public setScheduler(s: IScheduler) {
    this.scheduler = s;
  }

  public getUpdates(opts?: ApiParams<'getUpdates'>) {
    return this.requestJson('getUpdates', { ...opts });
  }

  public setWebhook(url: string, drop_pending_updates: boolean, opts?: ExtractParamOptions<'setWebhook', 'url'>) {
    return this.requestJson('setWebhook', { ...this.buildOptionalParams(opts), url, drop_pending_updates });
  }

  public deleteWebhook(drop_pending_updates: boolean) {
    return this.requestJson('deleteWebhook', { drop_pending_updates });
  }

  public async publishTelegraphPost(postTitle: string, markdown: string) {
    const nodes = await markdownToTelegraph(markdown);
    const page = await this.telegraph.createPage({
      accessToken: this.telegraphAccount.access_token!,
      authorName: this.telegraphAccount.author_name ?? 'Anonymous',
      title: postTitle,
      content: nodes,
      returnContent: false,
    });
    logger.trace(`Telegraph Page Created Successfully.`, { page });
    return page;
  }

  public sendChatAction(
    chat_id: ChatId,
    action: ApiParams<'sendChatAction'>['action'],
    opts?: ExtractParamOptions<'sendChatAction', 'chat_id' | 'action'>,
  ) {
    return this.requestJson('sendChatAction', { ...this.buildOptionalParams(opts), chat_id, action });
  }

  public async sendMessage(
    chat_id: ChatId,
    text: string,
    opts?: ExtractParamOptions<'sendMessage', 'chat_id' | 'text'>,
  ) {
    const res = await this.requestJson('sendMessage', {
      link_preview_options: { is_disabled: true },
      ...this.buildOptionalParams(opts),
      chat_id,
      text,
    });

    return this.processMessageResult<'sendMessage'>(res, chat_id, opts?.deleteAfterMs);
  }

  public async sendMessageDraft(
    chat_id: Integer,
    draft_id: Integer,
    text: string,
    opts?: ExtractParamOptions<'sendMessageDraft', 'chat_id' | 'draft_id' | 'text'>,
  ) {
    const res = await this.requestJson('sendMessageDraft', {
      ...this.buildOptionalParams(opts),
      chat_id,
      draft_id,
      text,
    });

    return this.processMessageResult<'sendMessageDraft'>(res, chat_id, opts?.deleteAfterMs);
  }

  public async sendPhoto(chat_id: ChatId, file: File, opts?: ExtractParamOptions<'sendPhoto', 'chat_id' | 'photo'>) {
    const res = await this.requestJson('sendPhoto', {
      ...this.buildOptionalParams(opts),
      chat_id,
      photo: file,
      show_caption_above_media: true,
    });
    return this.processMessageResult<'sendPhoto'>(res, chat_id, opts?.deleteAfterMs);
  }

  public async sendVoice(chat_id: ChatId, file: File, opts?: ExtractParamOptions<'sendVoice', 'chat_id' | 'voice'>) {
    const res = await this.requestJson('sendVoice', {
      ...this.buildOptionalParams(opts),
      chat_id,
      voice: file,
    });

    return this.processMessageResult<'sendVoice'>(res, chat_id, opts?.deleteAfterMs);
  }

  public async sendDocument(
    chat_id: ChatId,
    file: File,
    opts?: ExtractParamOptions<'sendDocument', 'chat_id' | 'document'>,
  ) {
    const res = await this.requestJson('sendDocument', {
      ...this.buildOptionalParams(opts),
      chat_id,
      document: file,
    });

    return this.processMessageResult<'sendDocument'>(res, chat_id, opts?.deleteAfterMs);
  }

  public async sendMediaGroup(
    chat_id: ChatId,
    files: File[],
    opts?: ExtractParamOptions<'sendMediaGroup', 'chat_id' | 'media'>,
  ) {
    const { caption, parse_mode, ...rest } = opts ?? {};
    const formData = new FormData();
    const mediaGroup = files.map((file, i): InputMediaDocument<File> => {
      const attachName = `attach_${i}`;
      formData.append(attachName, file, file.name);
      return {
        type: 'document',
        media: `attach://${attachName}`,
        ...(i === 0 && {
          caption,
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
    const res = await this.requestJson('sendMediaGroup', finalFormData);

    return this.processMessageResult<'sendMediaGroup'>(res, chat_id, opts?.deleteAfterMs);
  }

  public async editMessageText(
    chat_id: ChatId,
    message_id: Integer,
    text: string,
    opts?: ExtractParamOptions<'editMessageText', 'chat_id' | 'message_id' | 'text'>,
  ) {
    const res = await this.requestJson('editMessageText', {
      link_preview_options: { is_disabled: true },
      ...this.buildOptionalParams(opts),
      chat_id,
      message_id,
      text,
    });

    return this.processMessageResult<'editMessageText'>(res, chat_id, opts?.deleteAfterMs);
  }

  public async editMessageReplyMarkup(
    chat_id: ChatId,
    message_id: Integer,
    reply_markup: InlineKeyboardMarkup,
    opts?: ExtractParamOptions<'editMessageReplyMarkup', 'chat_id' | 'message_id' | 'reply_markup'>,
  ) {
    const res = await this.requestJson('editMessageReplyMarkup', {
      ...this.buildOptionalParams(opts),
      chat_id,
      message_id,
      reply_markup,
    });

    return this.processMessageResult<'editMessageReplyMarkup'>(res, chat_id, opts?.deleteAfterMs);
  }

  public deleteMessage(chat_id: ChatId, message_id: Integer) {
    return this.requestJson('deleteMessage', { chat_id, message_id });
  }

  public deleteMessages(chat_id: ChatId, message_ids: Integer[]) {
    return this.requestJson('deleteMessages', { chat_id, message_ids });
  }

  public setMessageReaction(chat_id: ChatId, message_id: Integer, emoji: ReactionTypeEmoji['emoji']) {
    return this.requestJson('setMessageReaction', { chat_id, message_id, reaction: [{ type: 'emoji', emoji }] });
  }

  public setBotCommands(commands: BotCommand[], chat_id: ChatId, user_id: Integer) {
    return this.requestJson('setMyCommands', {
      commands,
      scope: { type: 'chat_member', chat_id, user_id },
    });
  }

  public getFile(file_id: string) {
    return this.requestJson('getFile', { file_id });
  }

  public getChatMember(chat_id: ChatId, user_id: Integer) {
    return this.requestJson('getChatMember', { chat_id, user_id });
  }

  public answerCallbackQuery(
    callback_query_id: string,
    opts?: ExtractParamOptions<'answerCallbackQuery', 'callback_query_id'>,
  ) {
    return this.requestJson('answerCallbackQuery', {
      ...this.buildOptionalParams(opts),
      callback_query_id,
    });
  }

  public answerInlineQuery(
    inline_query_id: string,
    results: InlineQueryResult[],
    opts?: ExtractParamOptions<'answerInlineQuery', 'inline_query_id' | 'results'>,
  ) {
    return this.requestJson('answerInlineQuery', {
      ...this.buildOptionalParams(opts),
      inline_query_id,
      results,
    });
  }

  public leaveChat(chat_id: ChatId) {
    return this.requestJson('leaveChat', { chat_id });
  }

  public async requestJson<M extends ApiMethod>(method: M, params: ApiParams<M> | FormData): Promise<ApiReturn<M>> {
    logger.info(`[Telegram API] ${method} calling...`);
    logger.debug(`[Telegram API] ${method} params:`, { params });
    try {
      const apiUrl = this.getUrl(method);
      let response: RequestResult<'json'>;
      if (params instanceof FormData) {
        response = await this.formDataRequest(apiUrl, params);
      } else {
        const hasFile = Object.values(params).some((v) => v instanceof File || v instanceof Blob);
        if (hasFile) {
          const formData = this.makeFormData(params);
          response = await this.formDataRequest(apiUrl, formData);
        } else {
          response = await this.jsonRequest(apiUrl, params);
        }
      }
      const result = response.data as unknown as ApiResponse<ApiReturn<M>>;
      if (!result.ok) {
        const desc = `${result.error_code} - ${result.description}`;
        throw new TelegramError(this.handleError(desc, method, [JSON.stringify(result.parameters)]));
      }

      logger.debug(`[Telegram API] ${method} result:`, {
        ...result,
        result:
          typeof result.result === 'object' && !Array.isArray(result.result)
            ? { ...result.result, entities: [] }
            : result.result,
      });
      return result.result;
    } catch (err) {
      throw new TelegramError(this.handleError(err, method));
    }
  }

  private getUrl(method: ApiMethod): string {
    return `${TELEGRAM_BASE_URL}/bot${this.token}/${method}`;
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

  private makeFormData(params: Recordable, formData: FormData = new FormData()) {
    for (const [key, value] of Object.entries(params)) {
      if (value instanceof File) {
        formData.append(key, value, value.name);
      } else if (value instanceof Blob) {
        formData.append(key, value, 'blob');
      } else if (typeof value === 'object') {
        formData.append(key, JSON.stringify(value));
      } else {
        formData.append(key, value);
      }
    }
    return formData;
  }

  /**
   * Standardized handler for message API results.
   * Handles extraction of message IDs and delegates auto-deletion logic.
   */
  private processMessageResult<T extends ApiMethod>(
    result: ApiReturn<T>,
    chat_id: ChatId,
    deleteAfterMs?: number,
  ): ApiReturn<T> {
    if (!this.scheduler) {
      logger.warn('Scheduler is not set.');
      return result;
    }

    if (!deleteAfterMs) return result;

    let messageIdsToDelete: Integer[] = [];
    if (Array.isArray(result)) {
      const ids: Integer[] = result
        .map((item) => (isMessageIdProperty(item) ? item.message_id : null))
        .filter((id): id is Integer => id !== null);

      messageIdsToDelete = ids;
    } else if (isMessageIdProperty(result)) {
      messageIdsToDelete = [result.message_id];
    }

    if (messageIdsToDelete.length > 0) {
      this.scheduler.schedule('deleteMessages', { chat_id, message_ids: messageIdsToDelete }, deleteAfterMs);
    }

    return result;
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
    } as Omit<ApiParams<M>, X>;
  }

  private handleError(err: unknown, method: string, context?: (string | undefined)[]): string {
    const errMsg = err instanceof Error ? err.message : typeof err === 'string' ? err : String(err);
    const contextInfo = context && context.length > 0 ? context.filter(Boolean).join('\n') : 'N/A';
    logger.warn(`Failed to call Telegram API [${method}]: ${errMsg}`, {
      err,
      context: contextInfo,
    });
    return errMsg;
  }
}
