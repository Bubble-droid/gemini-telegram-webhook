/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
import { COMMANDS, type CommandType } from '@configs/commands.js';
import { MENTIONED_ALIAS } from '@configs/messages.js';
import type { ReactionTypeEmoji, Update } from '@grammyjs/types';
import { CONFIG } from '@shared/core/config.js';
import { TelegramError } from '@shared/core/errors.js';
import type { ApiReturn, Integer } from '@shared/types/telegram.js';
import type { ExtractMethods } from '@shared/types/utils.js';
import { hasFile, hasImage } from '@shared/utils/message.js';
import type { TelegramBotApi } from '@telegram/bot/telegram-bot-api.js';

type BotApiMethod = ExtractMethods<TelegramBotApi>;
type BotApiOptions<M extends BotApiMethod, N extends number> = Parameters<TelegramBotApi[M]>[N];

export class ResponseContext {
  private readonly botName = CONFIG.TELEGRAM_BOT_USERNAME;
  private repliedMessageId: number | null = null;

  constructor(
    public readonly update: Update,
    public readonly api: TelegramBotApi,
  ) {}

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
    if (!this.hasCommandEntity() || !this.text?.includes(`@${this.botName}`) || !this.text.startsWith('/')) return null;
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
      !!this.text?.includes(`@${this.botName}`) ||
      !!this.text?.startsWith(MENTIONED_ALIAS) ||
      this.replyToMessage?.from?.username === this.botName
    );
  }

  public async reply(text: string, opts?: BotApiOptions<'sendMessage', 2>) {
    const result = await this.api.sendMessage(this.chat.id, text, {
      ...opts,
      replyToMessageId: this.message?.message_id,
    });
    this.updateRepliedMessageId(result);
    return result;
  }

  public replyWithDocument(file: File, opts?: BotApiOptions<'sendDocument', 2>) {
    return this.api.sendDocument(this.chat.id, file, {
      ...opts,
      replyToMessageId: this.message?.message_id,
    });
  }

  public send(text: string, opts?: Omit<BotApiOptions<'sendMessage', 2>, 'replyToMessageId'>) {
    return this.api.sendMessage(this.chat.id, text, opts);
  }

  public updateMessage(text: string, opts?: BotApiOptions<'editMessageText', 3>) {
    if (!this.repliedMessageId) return this.reply(text, opts);
    return this.api.editMessageText(this.chat.id, this.repliedMessageId, text, opts);
  }

  public updateCallbackMessage(text: string, opts?: BotApiOptions<'editMessageText', 3>) {
    return this.api.editMessageText(this.chat.id, this.callbackQueryMessage!.message_id, text, opts);
  }

  public reaction(emoji: ReactionTypeEmoji['emoji'], messageId?: Integer) {
    return this.api.setMessageReaction(this.chat.id, messageId ?? this.message?.message_id!, emoji);
  }

  private updateRepliedMessageId(result: ApiReturn<'sendMessage' | 'sendDocument' | 'editMessageText'>) {
    if (typeof result !== 'boolean') {
      this.repliedMessageId ??= result.message_id;
    }
  }

  private hasCommandEntity() {
    return !!this.entities?.some((e) => e.type === 'bot_command');
  }
}
