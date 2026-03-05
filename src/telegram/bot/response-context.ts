/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
import { COMMANDS, type CommandType } from '@configs/commands.js';
import { MENTIONED_ALIAS } from '@configs/messages.js';
import type { ReactionTypeEmoji, Update } from '@grammyjs/types';
import { TelegramError } from '@shared/core/errors.js';
import type { Integer } from '@shared/types/telegram.js';
import type { ExtractMethods } from '@shared/types/utils.js';
import { hasFile, hasImage } from '@shared/utils/message.js';
import type { TelegramBotApi } from '@telegram/bot/telegram-bot-api.js';

type BotApiMethod = ExtractMethods<TelegramBotApi>;
type BotApiOptions<M extends BotApiMethod, N extends number> = Parameters<TelegramBotApi[M]>[N];

export class ResponseContext {
  private updatingMessageId: number | null = null;

  constructor(
    public readonly update: Update,
    public readonly api: TelegramBotApi,
  ) {}

  public get me() {
    return this.api.me;
  }

  public get callbackQuery() {
    return this.update.callback_query;
  }

  public get callbackQueryMessage() {
    return this.callbackQuery?.message;
  }

  public get callbackQueryId() {
    if (!this.callbackQuery) {
      throw new TelegramError('Callback query missing callback_query.id');
    }
    return this.callbackQuery.id;
  }

  public get callbackQueryData() {
    if (!this.callbackQuery?.data) {
      throw new TelegramError('Callback query missing callback_query.data');
    }
    return this.callbackQuery.data;
  }

  public get message() {
    return this.update.message;
  }

  public get replyToMessage() {
    return this.message?.reply_to_message;
  }

  public get chat() {
    const chat = this.message?.chat ?? this.callbackQueryMessage?.chat;
    if (!chat) {
      throw new TelegramError('Update missing chat');
    }
    return chat;
  }

  public get user() {
    const user = this.message?.from ?? this.callbackQuery?.from;
    if (!user) {
      throw new TelegramError('Update missing user');
    }
    return user;
  }

  public get text() {
    return this.message?.text ?? this.message?.caption;
  }

  public get entities() {
    return this.message?.entities ?? this.message?.caption_entities;
  }

  public get command(): { name: CommandType; args: readonly string[] } | null {
    if (!this.hasCommandEntity() || !this.text?.includes(`@${this.me.username}`) || !this.text.startsWith('/'))
      return null;
    const [rawCmd, ...args] = this.text.split(/\s+/);
    const name = rawCmd?.slice(1).split('@')[0];
    return COMMANDS.some((c) => c.command === name) ? { name: name as CommandType, args } : null;
  }

  public get isFile(): boolean {
    return hasFile(this.message) || hasFile(this.replyToMessage);
  }

  public get isImage(): boolean {
    return hasImage(this.message) || hasImage(this.replyToMessage);
  }

  public get isBotCommand(): boolean {
    return !!this.command?.name;
  }

  public get isBotMentioned(): boolean {
    return (
      !!this.text?.includes(`@${this.me.username}`) ||
      !!this.text?.startsWith(MENTIONED_ALIAS) ||
      this.replyToMessage?.from?.username === this.me.username
    );
  }

  public reply(text: string, opts?: BotApiOptions<'sendMessage', 2>) {
    return this.api.sendMessage(this.chat.id, text, opts);
  }

  public replyWithDocument(document: File, opts?: BotApiOptions<'sendDocument', 2>) {
    return this.api.sendDocument(this.chat.id, document, opts);
  }

  public replyWithPhoto(photo: File, opts?: BotApiOptions<'sendPhoto', 2>) {
    return this.api.sendPhoto(this.chat.id, photo, opts);
  }

  public replyWithChatAction(action: BotApiOptions<'sendChatAction', 1>, opts?: BotApiOptions<'sendChatAction', 2>) {
    return this.api.sendChatAction(this.chat.id, action, opts);
  }

  public async updateMessage(text: string, opts: BotApiOptions<'sendMessage', 2> = {}) {
    if (!this.updatingMessageId) {
      const result = await this.reply(text, opts);
      this.updatingMessageId = result.message_id;
      return result;
    }
    const { replyToMessageId, ...rest } = opts;
    return this.api.editMessageText(
      this.chat.id,
      this.updatingMessageId,
      text,
      rest as BotApiOptions<'editMessageText', 3>,
    );
  }

  public async updateMessageDocument(document: File, opts: BotApiOptions<'sendDocument', 2> = {}) {
    if (!this.updatingMessageId) {
      const result = await this.replyWithDocument(document, opts);
      this.updatingMessageId = result.message_id;
      return result;
    }
    const { replyToMessageId, ...rest } = opts;
    return this.api.editMessageDocument(
      this.chat.id,
      this.updatingMessageId,
      document,
      rest as BotApiOptions<'editMessageDocument', 3>,
    );
  }

  public updateCallbackMessage(text: string, opts?: BotApiOptions<'editMessageText', 3>) {
    return this.api.editMessageText(this.chat.id, this.callbackQueryMessage!.message_id, text, opts);
  }

  public delete(messageIds: Integer[]) {
    return this.api.deleteMessages(this.chat.id, messageIds);
  }

  public react(emoji: ReactionTypeEmoji['emoji'], messageId?: Integer) {
    return this.api.setMessageReaction(this.chat.id, messageId ?? this.message?.message_id!, emoji);
  }

  private hasCommandEntity() {
    return !!this.entities?.some((e) => e.type === 'bot_command');
  }
}
