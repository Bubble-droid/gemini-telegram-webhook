// src/types/telegram.d.ts

// --- 基础类型别名 ---

export type Integer = number;
export type ChatId = number | string;
export type InputFile = string | Blob | Buffer | NodeJS.ReadableStream; // 适配不同环境
export type ParseMode = 'HTML' | 'MarkdownV2' | 'Markdown';
export type EntityType =
  | 'mention'
  | 'bot_command'
  | 'url'
  | 'pre'
  | 'text_link'
  | 'text_mention'
  | 'bold'
  | 'italic'
  | 'code'
  | 'strikethrough'
  | 'underline'
  | 'spoiler'
  | 'custom_emoji'
  | 'blockquote';
export type ApiMethod =
  | 'setWebhook'
  | 'deleteWebhook'
  | 'sendMessage'
  | 'sendPhoto'
  | 'sendVoice'
  | 'sendDocument'
  | 'sendMediaGroup'
  | 'editMessageText'
  | 'editMessageReplyMarkup'
  | 'deleteMessage'
  | 'deleteMessages'
  | 'setMyCommands'
  | 'getFile'
  | 'getChatMember'
  | 'answerInlineQuery'
  | 'answerCallbackQuery'
  | 'leaveChat';

// --- 核心对象模型 ---

export interface Update {
  update_id: Integer;
  message?: Message;
  edited_message?: Message;
  channel_post?: Message;
  edited_channel_post?: Message;
  inline_query?: InlineQuery;
  callback_query?: CallbackQuery;
  my_chat_member?: ChatMemberUpdated;
  chat_member?: ChatMemberUpdated;
}

export interface User {
  id: Integer;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: true;
  added_to_attachment_menu?: true;
}

export interface Chat {
  id: Integer;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  is_forum?: true;
}

export interface Message {
  message_id: Integer;
  message_thread_id?: Integer;
  from?: User;
  sender_chat?: Chat;
  date: Integer;
  chat: Chat;
  forward_origin?: MessageOrigin;
  is_topic_message?: boolean;
  is_automatic_forward?: boolean;
  reply_to_message?: Message;
  quote?: TextQuote;
  reply_parameters?: ReplyParameters;
  via_bot?: User;
  edit_date?: Integer;
  has_protected_content?: true;
  media_group_id?: string;
  author_signature?: string;
  text?: string;
  entities?: MessageEntity[];
  link_preview_options?: LinkPreviewOptions;
  audio?: Audio;
  document?: Document;
  photo?: PhotoSize[];
  sticker?: Sticker;
  video?: Video;
  voice?: Voice;
  caption?: string;
  caption_entities?: MessageEntity[];
  has_media_spoiler?: true;
  new_chat_members?: User[];
  left_chat_member?: User;
  new_chat_title?: string;
  new_chat_photo?: PhotoSize[];
  delete_chat_photo?: true;
  group_chat_created?: true;
  supergroup_chat_created?: true;
  channel_chat_created?: true;
  migrate_to_chat_id?: Integer;
  migrate_from_chat_id?: Integer;
  pinned_message?: Message;
  connected_website?: string;
  reply_markup?: InlineKeyboardMarkup;
}

export interface MessageEntity {
  type: EntityType;
  offset: Integer;
  length: Integer;
  url?: string;
  user?: User;
  language?: string;
  custom_emoji_id?: string;
}

export interface PhotoSize {
  file_id: string;
  file_unique_id: string;
  width: Integer;
  height: Integer;
  file_size?: Integer;
}

export interface Audio {
  file_id: string;
  file_unique_id: string;
  duration: Integer;
  performer?: string;
  title?: string;
  file_name?: string;
  mime_type?: string;
  file_size?: Integer;
  thumbnail?: PhotoSize;
}

export interface Document {
  file_id: string;
  file_unique_id: string;
  thumbnail?: PhotoSize;
  file_name?: string;
  mime_type?: string;
  file_size?: Integer;
}

export interface Video {
  file_id: string;
  file_unique_id: string;
  width: Integer;
  height: Integer;
  duration: Integer;
  thumbnail?: PhotoSize;
  file_name?: string;
  mime_type?: string;
  file_size?: Integer;
}

export interface Voice {
  file_id: string;
  file_unique_id: string;
  duration: Integer;
  mime_type?: string;
  file_size?: Integer;
}

export interface Sticker {
  file_id: string;
  file_unique_id: string;
  type: 'regular' | 'mask' | 'custom_emoji';
  width: Integer;
  height: Integer;
  is_animated?: boolean;
  is_video?: boolean;
  thumbnail?: PhotoSize;
  emoji?: string;
  set_name?: string;
  premium_animation?: TFile;
  custom_emoji_id?: string;
  needs_repainting?: true;
  file_size?: Integer;
}

export interface TFile {
  file_id: string;
  file_unique_id: string;
  file_size?: Integer;
  file_path?: string;
}

export interface CallbackQuery {
  id: string;
  from: User;
  message?: Message;
  inline_message_id?: string;
  chat_instance: string;
  data?: string;
  game_short_name?: string;
}

export interface InlineQuery {
  id: string;
  from: User;
  query: string;
  offset: string;
  chat_type?: 'sender' | 'private' | 'group' | 'supergroup' | 'channel';
}

export interface ChatMemberUpdated {
  chat: Chat;
  from: User;
  date: Integer;
  old_chat_member: ChatMember;
  new_chat_member: ChatMember;
  via_join_request?: boolean;
  via_chat_folder_invite_link?: boolean;
}

// --- 消息来源 ---

export type MessageOrigin = MessageOriginUser | MessageOriginHiddenUser | MessageOriginChat | MessageOriginChannel;

export interface MessageOriginUser {
  type: 'user';
  date: Integer;
  sender_user: User;
}

export interface MessageOriginHiddenUser {
  type: 'hidden_user';
  date: Integer;
  sender_user_name: string;
}

export interface MessageOriginChat {
  type: 'chat';
  date: Integer;
  sender_chat: Chat;
  author_signature?: string;
}

export interface MessageOriginChannel {
  type: 'channel';
  date: Integer;
  chat: Chat;
  message_id: Integer;
  author_signature?: string;
}

// --- 聊天成员 ---

export type ChatMember =
  | ChatMemberOwner
  | ChatMemberAdministrator
  | ChatMemberMember
  | ChatMemberRestricted
  | ChatMemberLeft
  | ChatMemberBanned;

interface ChatMemberBase {
  user: User;
}

export interface ChatMemberOwner extends ChatMemberBase {
  status: 'creator';
  is_anonymous: boolean;
  custom_title?: string;
}

export interface ChatMemberAdministrator extends ChatMemberBase {
  status: 'administrator';
  can_be_edited: boolean;
  is_anonymous: boolean;
  can_manage_chat: boolean;
  can_delete_messages: boolean;
  can_manage_video_chats: boolean;
  can_restrict_members: boolean;
  can_promote_members: boolean;
  can_change_info: boolean;
  can_invite_users: boolean;
  can_post_stories: boolean;
  can_edit_stories: boolean;
  can_delete_stories: boolean;
  can_post_messages?: boolean;
  can_edit_messages?: boolean;
  can_pin_messages?: boolean;
  can_manage_topics?: boolean;
  custom_title?: string;
}

export interface ChatMemberMember extends ChatMemberBase {
  status: 'member';
  until_date?: Integer;
}

export interface ChatMemberRestricted extends ChatMemberBase {
  status: 'restricted';
  is_member: boolean;
  can_send_messages: boolean;
  can_send_audios: boolean;
  can_send_documents: boolean;
  can_send_photos: boolean;
  can_send_videos: boolean;
  can_send_video_notes: boolean;
  can_send_voice_notes: boolean;
  can_send_polls: boolean;
  can_send_other_messages: boolean;
  can_add_web_page_previews: boolean;
  can_change_info: boolean;
  can_invite_users: boolean;
  can_pin_messages: boolean;
  can_manage_topics: boolean;
  until_date: Integer;
}

export interface ChatMemberLeft extends ChatMemberBase {
  status: 'left';
}

export interface ChatMemberBanned extends ChatMemberBase {
  status: 'kicked';
  until_date: Integer;
}

// --- 请求参数公共接口 (DRY Optimization) ---

interface WebhookCommonParams {
  drop_pending_updates?: boolean;
}

/** 所有发送消息类 API 的基础参数 */
interface SendCommonParams {
  chat_id: ChatId;
  message_thread_id?: Integer;
  disable_notification?: boolean;
  protect_content?: boolean;
  reply_parameters?: ReplyParameters;
  reply_markup?: string;
}

/** 包含 Caption 的消息参数 */
interface CaptionParams {
  caption?: string;
  parse_mode?: ParseMode;
  caption_entities?: MessageEntity[];
  show_caption_above_media?: boolean;
}

/** 包含文本内容的消息参数 */
interface TextParams {
  text: string;
  parse_mode?: ParseMode;
  entities?: string;
  link_preview_options?: LinkPreviewOptions;
}

// --- API 方法参数 ---

export interface SetWebhookParams extends WebhookCommonParams {
  url: string;
  ip_address?: string;
  max_connections?: Integer;
  allowed_updates?: string[];
  secret_token?: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface DeleteWebHookParams extends WebhookCommonParams {}

export interface SendMessageParams extends SendCommonParams, TextParams {}

export interface SendPhotoParams extends SendCommonParams, CaptionParams {
  photo: InputFile;
  has_spoiler?: boolean;
}

export interface SendVoiceParams extends SendCommonParams, CaptionParams {
  voice: InputFile;
  duration?: Integer;
}

export interface SendDocumentParams extends SendCommonParams, CaptionParams {
  document: InputFile;
  thumbnail?: InputFile;
  disable_content_type_detection?: boolean;
}

export interface SendMediaGroupParams extends Omit<SendCommonParams, 'reply_markup'> {
  media: InputMedia[];
}

// --- 编辑消息 ---

interface EditMessageBase {
  chat_id?: ChatId;
  message_id?: Integer;
  inline_message_id?: string;
  reply_markup?: string;
}

export interface EditMessageTextParams extends EditMessageBase, Partial<TextParams> {}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface EditMessageReplyMarkupParams extends EditMessageBase {}

export interface EditMessageCaptionParams extends EditMessageBase, CaptionParams {}

// --- 删除与管理 ---

export interface DeleteMessageParams {
  chat_id: ChatId;
  message_id: Integer;
}

export interface DeleteMessagesParams {
  chat_id: ChatId;
  message_ids: Integer[];
}

export interface GetFileParams {
  file_id: string;
}

export interface GetChatMemberParams {
  chat_id: ChatId;
  user_id: Integer;
}

export interface LeaveChatParams {
  chat_id: ChatId;
}

// --- 命令管理 ---

export interface BotCommand {
  command: string;
  description: string;
}

export interface SetBotCommandParams {
  commands: BotCommand[];
  scope?: BotCommandScope;
  language_code?: string;
}

export type BotCommandScope =
  | { type: 'default' | 'all_private_chats' | 'all_group_chats' | 'all_chat_administrators' }
  | { type: 'chat' | 'chat_administrators'; chat_id: ChatId }
  | { type: 'chat_member'; chat_id: ChatId; user_id: Integer };

// --- 键盘与 Markup ---

export type ReplyMarkup = InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReply;

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface ReplyKeyboardMarkup {
  keyboard: KeyboardButton[][];
  is_persistent?: boolean;
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
  input_field_placeholder?: string;
  selective?: boolean;
}

export interface ReplyKeyboardRemove {
  remove_keyboard: true;
  selective?: boolean;
}

export interface ForceReply {
  force_reply: true;
  input_field_placeholder?: string;
  selective?: boolean;
}

export interface InlineKeyboardButton {
  text: string;
  url?: string;
  callback_data?: string;
  switch_inline_query?: string;
  switch_inline_query_current_chat?: string;
  pay?: boolean;
}

export interface KeyboardButton {
  text: string;
  request_contact?: boolean;
  request_location?: boolean;
}

// --- Input Media ---

export type InputMedia = InputMediaPhoto | InputMediaVideo | InputMediaAnimation | InputMediaAudio | InputMediaDocument;

interface InputMediaBase {
  media: string; // file_id or url
  caption?: string;
  parse_mode?: ParseMode;
  caption_entities?: MessageEntity[];
}

export interface InputMediaPhoto extends InputMediaBase {
  type: 'photo';
  show_caption_above_media?: boolean;
  has_spoiler?: boolean;
}

export interface InputMediaVideo extends InputMediaBase {
  type: 'video';
  thumbnail?: InputFile;
  width?: Integer;
  height?: Integer;
  duration?: Integer;
  supports_streaming?: boolean;
  has_spoiler?: boolean;
  show_caption_above_media?: boolean;
}

export interface InputMediaAudio extends InputMediaBase {
  type: 'audio';
  thumbnail?: InputFile;
  duration?: Integer;
  performer?: string;
  title?: string;
}

export interface InputMediaDocument extends InputMediaBase {
  type: 'document';
  thumbnail?: InputFile;
  disable_content_type_detection?: boolean;
}

export interface InputMediaAnimation extends InputMediaBase {
  type: 'animation';
  thumbnail?: InputFile;
  width?: Integer;
  height?: Integer;
  duration?: Integer;
  has_spoiler?: boolean;
}

// --- 内联模式 (Inline Query) ---

export interface AnswerInlineQueryParams {
  inline_query_id: string;
  results: string;
  cache_time?: Integer;
  is_personal?: boolean;
  next_offset?: string;
  button?: string;
}

export interface InlineQueryResultsButton {
  text: string;
  start_parameter: string;
}

export type InlineQueryResult = InlineQueryResultArticle | InlineQueryResultVoice | InlineQueryResultPhoto;

export interface InlineQueryResultArticle {
  type: 'article';
  id: string;
  title: string;
  reply_markup?: InlineKeyboardMarkup;
  url?: string;
  description?: string;
  thumbnail_url?: string;
  thumbnail_width?: Integer;
  thumbnail_height?: Integer;
}

export interface InlineQueryResultVoice {
  type: 'voice';
  id: string;
  voice_url: string;
  title: string;
  caption?: string;
  parse_mode?: ParseMode;
  caption_entities?: MessageEntity[];
  voice_duration?: Integer;
  reply_markup?: InlineKeyboardMarkup;
}

export interface InlineQueryResultPhoto {
  type: 'photo';
  id: string;
  photo_url: string;
  thumbnail_url: string;
  photo_width?: Integer;
  photo_height?: Integer;
  title?: string;
  description?: string;
  caption?: string;
  parse_mode?: ParseMode;
  caption_entities?: MessageEntity[];
  reply_markup?: InlineKeyboardMarkup;
}

// --- 杂项与响应 ---

export interface LinkPreviewOptions {
  is_disabled?: boolean;
  url?: string;
  prefer_small_media?: boolean;
  prefer_large_media?: boolean;
  show_above_text?: boolean;
}

export interface TextQuote {
  text: string;
  entities?: MessageEntity[];
  position: Integer;
  is_manual?: true;
}

export interface ReplyParameters {
  message_id: Integer;
  chat_id?: ChatId;
  allow_sending_without_reply?: boolean;
  quote?: string;
  quote_parse_mode?: ParseMode;
  quote_entities?: MessageEntity[];
  quote_position?: Integer;
}

export interface AnswerCallbackQueryParams {
  callback_query_id: string;
  text?: string;
  show_alert?: boolean;
  url?: string;
  cache_time?: Integer;
}

// --- API 响应 ---

export type ApiResponse<T> =
  | { ok: true; result: T }
  | { ok: false; error_code: Integer; description: string; parameters?: ResponseParameters };

export interface ResponseParameters {
  migrate_to_chat_id?: Integer;
  retry_after?: Integer;
}

// --- 本地命令定义接口 (非 Telegram 官方类型，但常用于 Bot 框架) ---

export interface BotCommandAction {
  name: string;
  description: string;
  action: (chatId: number, userId: number, messageId: number, options?: CommandActionOptionsParams) => Promise<void>;
}

export interface CommandActionOptionsParams {
  isCallback?: boolean;
  cleanText?: string;
  message?: Message;
}
