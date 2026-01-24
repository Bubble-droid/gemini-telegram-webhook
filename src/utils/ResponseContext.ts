import type { TelegramBotAPI } from '@/services/apis';
import { bot } from '@/services/apis';
import { CONFIG } from '@/services/ConfigLoader';
import type { ApiResult, ExtractMethods } from '@/types';
import type { CallbackQuery, Chat, Message, MessageEntity, User } from 'grammy/types';
import { AppError } from './errors';
import { hasFile, hasImage } from './message';

type BotApiMethod = ExtractMethods<TelegramBotAPI>;
type BotApiOptions<M extends BotApiMethod, N extends number> = Parameters<TelegramBotAPI[M]>[N];

export class ResponseContext {
  public readonly messages: Message[];
  public readonly callBackQuery?: CallbackQuery | undefined;
  public readonly primaryMessage: Message;
  public lastMessageId: number | undefined;

  private readonly botName = CONFIG.TELEGRAM_BOT_USERNAME;
  private readonly replyToMessageId: number;
  private readonly messageIdToEdit: number;

  constructor(messages: Message[], callBackQuery?: CallbackQuery) {
    this.messages = messages;
    this.callBackQuery = callBackQuery;
    this.primaryMessage = this.getPrimaryMessage();
    this.replyToMessageId = this.primaryMessage.message_id;
    this.messageIdToEdit = this.primaryMessage.message_id;
  }

  public get chat(): Chat {
    return this.primaryMessage.chat;
  }

  public get user(): User {
    const user = this.callBackQuery?.from ?? this.primaryMessage.from;
    if (!user) throw new AppError('Missing user.');
    return user;
  }

  public get callBackQueryId(): string | undefined {
    return this.callBackQuery?.id;
  }

  public get callBackQueryData(): string | undefined {
    return this.callBackQuery?.data;
  }

  public get hasValidFile(): boolean {
    return this.messages.some((m) => {
      return hasFile(m) || hasFile(m.reply_to_message);
    });
  }

  public get hasValidImage(): boolean {
    return this.messages.some((m) => {
      return hasImage(m) || hasImage(m.reply_to_message);
    });
  }

  /**
   * 检查是否在消息中提到了机器人。
   */
  public checkBotMentioned(): boolean {
    return this.messages.some((m) => {
      const mentionedText = this.getEntityText(m, ['text_mention', 'mention']);
      return mentionedText?.includes(this.botName);
    });
  }

  /**
   * 检查是否是显式指向该机器人的命令。
   */
  public checkBotCommand(): Message | undefined {
    return this.messages.find((m) => {
      const commandText = this.getEntityText(m, ['bot_command']);
      return commandText?.includes(this.botName);
    });
  }

  public checkCommandAlias(): string | undefined {
    const aliasMsg = this.messages.find((m) => {
      return this.getText(m).startsWith(':');
    });
    if (!aliasMsg) return undefined;
    return this.getText(aliasMsg);
  }

  public reply(text: string, opts: BotApiOptions<'editMessageText', 3>): Promise<ApiResult<'editMessageText'>>;
  public reply(text: string, opts?: BotApiOptions<'sendMessage', 2>): Promise<ApiResult<'sendMessage'>>;
  public async reply(
    text: string,
    opts?: BotApiOptions<'sendMessage', 2> | BotApiOptions<'editMessageText', 3>,
  ): Promise<ApiResult<'sendMessage' | 'editMessageText'>> {
    let result: ApiResult<'sendMessage' | 'editMessageText'>;

    if (this.isEditContext(opts)) {
      result = await this.edit(text, opts);
    } else {
      result = await this.send(text, { opts, isReply: true });
    }

    return result;
  }

  public async send(
    text: string,
    { opts, isReply = false }: { opts?: BotApiOptions<'sendMessage', 2>; isReply?: boolean } = {},
  ): Promise<ApiResult<'sendMessage'>> {
    const result = await bot.sendMessage(this.chat.id, text, {
      ...opts,
      ...(isReply && { replyToMessageId: this.lastMessageId ?? this.replyToMessageId }),
    });
    this.updateLastMessageId(result);
    return result;
  }

  /**
   * 强制编辑当前维护的消息（适用于 Loading 后的状态更新）
   */
  public async edit(text: string, opts?: BotApiOptions<'editMessageText', 3>): Promise<ApiResult<'editMessageText'>> {
    const result = await bot.editMessageText(this.chat.id, this.lastMessageId ?? this.messageIdToEdit, text, opts);
    this.updateLastMessageId(result);
    return result;
  }

  public getEntityText(m: Message, entityTypes: MessageEntity['type'][]): string | undefined {
    const targetEntity = this.getEntities(m).find((e) => entityTypes.includes(e.type));
    if (!targetEntity) return undefined;
    return this.getText(m).substring(targetEntity.offset, targetEntity.offset + targetEntity.length);
  }

  public getText(m: Message): string {
    return m.text ?? m.caption ?? '';
  }

  private updateLastMessageId(result: ApiResult<'sendMessage' | 'editMessageText'>): void {
    if (result.ok && typeof result.data !== 'boolean') {
      this.lastMessageId = result.data.message_id;
    }
  }

  private isEditContext = (
    opts?: BotApiOptions<'sendMessage', 2> | BotApiOptions<'editMessageText', 3>,
  ): opts is BotApiOptions<'editMessageText', 3> => {
    const hasReplyId = opts && 'replyToMessageId' in opts;
    return !!((this.callBackQueryData ?? this.lastMessageId) && !hasReplyId);
  };

  private getEntities(m: Message): MessageEntity[] {
    return m.entities ?? m.caption_entities ?? [];
  }

  private getPrimaryMessage(): Message {
    const primaryMessage = this.callBackQuery?.message ?? this.messages.at(-1);
    if (!primaryMessage) {
      throw new AppError('Missing message.');
    }
    return primaryMessage;
  }
}
