import { BotCommands } from '@configs/bot-commands.js';
import type { CallbackQuery, Chat, Message, MessageEntity, Update, User } from '@grammyjs/types';
import { CONFIG } from '@shared/core/config.js';
import { DataError } from '@shared/core/errors.js';
import type { ApiResult } from '@shared/types/telegram.js';
import type { ExtractMethods } from '@shared/types/utils.js';
import { hasFile, hasImage } from '@shared/utils/message.js';
import type { TelegramBotApi } from '@telegram/bot/telegram-bot-api.js';

type BotApiMethod = ExtractMethods<TelegramBotApi>;
type BotApiOptions<M extends BotApiMethod, N extends number> = Parameters<TelegramBotApi[M]>[N];

export class ResponseContext {
  public lastMessageId: number | undefined;

  private readonly botName = CONFIG.TELEGRAM_BOT_USERNAME;
  private botApi: TelegramBotApi | undefined;
  private readonly _update: Update;
  private readonly _message: Message | undefined;
  private readonly _callBackQuery?: CallbackQuery | undefined;

  constructor(update: Update, botApi: TelegramBotApi) {
    const { message, callback_query } = update;
    this.botApi = botApi;
    this._update = update;
    this._message = message;
    this._callBackQuery = callback_query;
  }

  public get api(): TelegramBotApi {
    if (!this.botApi) {
      throw new DataError('Bot API not initialized.');
    }
    return this.botApi;
  }

  public get update(): Update {
    return this._update;
  }

  public get callBackQuery(): CallbackQuery | undefined {
    return this._callBackQuery;
  }

  public get message(): Message {
    const message = this.callBackQuery?.message ?? this._message;
    if (!message) {
      throw new DataError('Missing message.');
    }
    return message;
  }

  public get replyToMessage(): Message | undefined {
    return this.message.reply_to_message;
  }

  public get chat(): Chat {
    return this.message.chat;
  }

  public get user(): User {
    const user = this.callBackQuery?.from ?? this.message.from;
    if (!user) {
      throw new DataError('Missing user.');
    }
    return user;
  }

  public get text(): string | undefined {
    return this.message.text ?? this.message.caption;
  }

  public get botCommandText(): string | undefined {
    return this.botCommandEntity ? this.getEntityText(this.botCommandEntity) : undefined;
  }

  public get entities(): MessageEntity[] | undefined {
    return this.message.entities ?? this.message.caption_entities;
  }

  public get botCommandEntity(): MessageEntity | undefined {
    return this.entities?.find((entity) => {
      if (entity.type !== 'bot_command') return false;
      return this.getEntityText(entity).includes(this.botName);
    });
  }

  public get callBackQueryId(): string | undefined {
    return this.callBackQuery?.id;
  }

  public get callBackQueryData(): string | undefined {
    return this.callBackQuery?.data;
  }

  public get isFile(): boolean {
    return hasFile(this.message) || hasFile(this.replyToMessage);
  }

  public get isImage(): boolean {
    return hasImage(this.message) || hasImage(this.replyToMessage);
  }

  public get isBotMentioned(): boolean {
    if (!this.entities) return false;
    return this.entities.some((entity) => {
      if (!['text_mention', 'mention'].includes(entity.type)) return false;
      return this.getEntityText(entity).includes(this.botName);
    });
  }

  public get isBotCommand(): boolean {
    return !!this.botCommandEntity;
  }

  public get isMentionAlias(): boolean {
    return !!this.text?.startsWith(`:ask`);
  }

  public get isCommandAlias(): boolean {
    if (!this.text?.startsWith(':')) return false;
    const alias = this.text.slice(1).split(' ')[0];
    return BotCommands.some((c) => c.command === alias);
  }

  public get isReplyToBot(): boolean {
    return this.replyToMessage?.from?.username === this.botName;
  }

  public reply(text: string, opts: BotApiOptions<'editMessageText', 3>): Promise<ApiResult<'editMessageText'>>;
  public reply(text: string, opts?: BotApiOptions<'sendMessage', 2>): Promise<ApiResult<'sendMessage'>>;
  public async reply(
    text: string,
    opts?: BotApiOptions<'sendMessage', 2>,
  ): Promise<ApiResult<'sendMessage' | 'editMessageText'>> {
    let result: ApiResult<'sendMessage' | 'editMessageText'>;

    if (this.isEditContext(opts)) {
      result = await this.edit(text, opts);
    } else {
      result = await this.send(text, { opts, isToReply: true });
    }

    return result;
  }

  public async send(
    text: string,
    { opts, isToReply }: { opts?: BotApiOptions<'sendMessage', 2>; isToReply: boolean },
  ): Promise<ApiResult<'sendMessage'>> {
    const result = await this.api.sendMessage(this.chat.id, text, {
      ...opts,
      ...(isToReply && { replyToMessageId: this.lastMessageId ?? this.message.message_id }),
    });
    this.updateLastMessageId(result);
    return result;
  }

  public async edit(text: string, opts?: BotApiOptions<'editMessageText', 3>): Promise<ApiResult<'editMessageText'>> {
    const result = await this.api.editMessageText(
      this.chat.id,
      this.lastMessageId ?? this.message.message_id,
      text,
      opts,
    );
    this.updateLastMessageId(result);
    return result;
  }

  public getEntityText(entity: MessageEntity): string {
    return this.text?.substring(entity.offset, entity.offset + entity.length) ?? '';
  }

  private updateLastMessageId(result: ApiResult<'sendMessage' | 'editMessageText'>): void {
    if (result.ok && typeof result.data !== 'boolean') {
      this.lastMessageId = result.data.message_id;
    }
  }

  private isEditContext = (opts?: BotApiOptions<'sendMessage', 2>): opts is BotApiOptions<'editMessageText', 3> => {
    const hasReplyId = opts && 'replyToMessageId' in opts;
    return !!((this.callBackQueryData ?? this.lastMessageId) && !hasReplyId);
  };
}
