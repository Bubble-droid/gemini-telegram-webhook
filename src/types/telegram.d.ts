// src/types/telegram.d.ts

export interface Update {
  update_id: number;
  message?: Message;
  edited_message?: Message;
  chat_member?: ChatMemberUpdated;
}

export interface Message {
  message_id: number;
  message_thread_id?: number;
  direct_messages_topic?: DirectMessagesTopic;
  from?: User;
  sender_chat?: Chat;
  date: number;
  chat: Chat;
  forward_origin?: MessageOrigin;
  reply_to_message?: Message;
  quote?: TextQuote;
  via_bot?: User;
  edit_date?: number;
  has_protected_content?: true;
  is_from_offline?: true;
  media_group_id?: string;
  text?: string;
  entities?: MessageEntity[];
  link_preview_options?: LinkPreviewOptions;
  document?: Document;
  photo?: PhotoSize[];
  sticker?: Sticker;
  video?: Video;
  caption?: string;
  caption_entities?: MessageEntity[];
  show_caption_above_media?: true;
  new_chat_member?: User;
  new_chat_members?: User[];
}

export interface DirectMessagesTopic {
  topic_id: number;
  user?: User;
}

export interface User {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: true;
}

export interface Chat {
  id: number;
  type: ChatType;
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export type ChatType = 'private' | 'group' | 'supergroup' | 'channel';

export type MessageOrigin = MessageOriginUser | MessageOriginHiddenUser | MessageOriginChat | MessageOriginChannel;

export interface MessageOriginUser {
  type: 'user';
  date: number;
  sender_user?: User;
}

export interface MessageOriginHiddenUser {
  type: 'hidden_user';
  date: number;
  sender_user_name: string;
}

export interface MessageOriginChat {
  type: 'chat';
  date: number;
  sender_chat: Chat;
  author_signature?: string;
}

export interface MessageOriginChannel {
  type: 'channel';
  date: number;
  chat: Chat;
  message_id: number;
  author_signature?: string;
}

export interface TextQuote {
  text: string;
  entities?: MessageEntity[];
  position: number;
  is_manual?: true;
}

export interface MessageEntity {
  type: EntityType;
  offset: number;
  length: number;
  url?: string;
  user?: User;
  language?: string;
}

export type EntityType = 'mention' | 'bot_command' | 'url' | 'pre' | 'text_link' | 'text_mention';

export interface LinkPreviewOptions {
  is_disabled?: boolean;
  url?: string;
  prefer_small_media?: boolean;
  prefer_large_media?: boolean;
  show_above_text?: boolean;
}

export interface Document {
  file_id: string;
  file_unique_id: string;
  thumbnail?: PhotoSize;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface PhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

export interface Sticker {
  file_id: string;
  file_unique_id: string;
  type: StickerType;
  width: number;
  height: number;
  is_animated?: boolean;
  is_video?: boolean;
  thumbnail?: PhotoSize;
  emoji?: string;
  set_name?: string;
  premium_animation?: File;
  needs_repainting?: true;
  file_size?: number;
}

export type StickerType = 'regular' | 'mask' | 'custom_emoji';

export interface Video {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  duration: number;
  thumbnail?: PhotoSize;
  cover?: PhotoSize[];
  start_timestamp?: number;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface File {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_path?: string;
}

export interface ChatMemberUpdated {
  chat: Chat;
  from: User;
  date: number;
  old_chat_member: ChatMember;
  new_chat_member: ChatMember;
  invite_link?: ChatInviteLink;
  via_join_request?: boolean;
  via_chat_folder_invite_link?: boolean;
}

export type ChatMember = ChatMemberOwner | ChatMemberAdministrator | ChatMemberMember | ChatMemberRestricted | ChatMemberLeft | ChatMemberBanned;

export interface ChatMemberOwner {
  status: 'creator';
  user: User;
  is_anonymous: boolean;
  custom_title?: string;
}

export interface ChatMemberAdministrator {
  status: 'administrator';
  user: User;
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
  can_manage_direct_messages?: boolean;
  custom_title?: string;
}

export interface ChatMemberMember {
  status: 'member';
  user: User;
  until_date?: number;
}

export interface ChatMemberRestricted {
  status: 'restricted';
  user: User;
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
  until_date: number;
}

export interface ChatMemberLeft {
  status: 'left';
  user: User;
}

export interface ChatMemberBanned {
  status: 'kicked';
  user: User;
  until_date: number;
}

export interface ChatInviteLink {
  invite_link: string;
  creator: User;
  creates_join_request: boolean;
  is_primary: boolean;
  is_revoked: boolean;
  name?: string;
  expire_date?: number;
  member_limit?: number;
  pending_join_request_count?: number;
  subscription_period?: number;
  subscription_price?: number;
}

export interface BotCommandAction {
  name: string;
  description: string;
  action: (params: CommandActionParams) => Promise<void>;
}

export interface CommandActionParams {
  chatId: number;
  messageId: number;
  userId: number;
  message: Message;
}

export interface BotCommand {
  command: string;
  description: string;
}

export interface SendMessageParams {
  chat_id: number | string;
  text: string;
  parse_mode?: ParseMode;
  entities?: MessageEntity[];
  link_preview_options?: LinkPreviewOptions;
  protect_content?: boolean;
  reply_parameters?: ReplyParameters;
}

export type ParseMode = 'HTML' | 'MarkdownV2' | 'Markdown';

export interface ReplyParameters {
  message_id: number;
  chat_id?: number | string;
  allow_sending_without_reply?: boolean;
  quote?: string;
  quote_parse_mode?: ParseMode;
  quote_entities?: MessageEntity[];
  quote_position?: number;
  checklist_task_id?: number;
}

export type SendMessageResult = Message;

export interface SendPhotoParams {
  chat_id: number | string;
  photo: Buffer;
  caption?: string;
  parse_mode?: ParseMode;
  caption_entities?: MessageEntity[];
  show_caption_above_media?: boolean;
  has_spoiler?: boolean;
  protect_content?: boolean;
  reply_parameters?: ReplyParameters;
}

export type SendPhotoResult = Message;

export interface SendVoiceParams {
  chat_id: number | string;
  voice: Buffer;
  caption?: string;
  parse_mode?: ParseMode;
  caption_entities?: MessageEntity[];
  duration?: number;
  protect_content?: boolean;
  reply_parameters?: ReplyParameters;
}

export type SendVoiceResult = Message;

export interface EditMessageTextParams {
  chat_id: number | string;
  message_id: number;
  text: string;
  parse_mode?: ParseMode;
  entities?: MessageEntity[];
  link_preview_options?: LinkPreviewOptions;
}

export type EditMessageTextResult = Message;

export interface DeleteMessageParams {
  chat_id: number | string;
  message_id: number;
}

export type DeleteMessageResult = boolean;

export interface DeleteMessagesParams {
  chat_id: number | string;
  message_ids: number[];
}

export type DeleteMessagesResult = boolean;

export interface SetBotCommandParams {
  commands: BotCommand[];
  scope?: BotCommandScope;
  language_code?: string;
}

export type BotCommandScope =
  | BotCommandScopeDefault
  | BotCommandScopeAllPrivateChats
  | BotCommandScopeAllGroupChats
  | BotCommandScopeAllChatAdministrators
  | BotCommandScopeChat
  | BotCommandScopeChatAdministrators
  | BotCommandScopeChatMember;

export interface BotCommandScopeDefault {
  type: 'default';
}

export interface BotCommandScopeAllPrivateChats {
  type: 'all_private_chats';
}

export interface BotCommandScopeAllGroupChats {
  type: 'all_group_chats';
}

export interface BotCommandScopeAllChatAdministrators {
  type: 'all_chat_administrators';
}

export interface BotCommandScopeChat {
  type: 'chat';
  chat_id: number | string;
}

export interface BotCommandScopeChatAdministrators {
  type: 'chat_administrators';
  chat_id: number | string;
}

export interface BotCommandScopeChatMember {
  type: 'chat_member';
  chat_id: number | string;
  user_id: number;
}

export type SetBotCommandResult = boolean;

export interface GetFileParams {
  file_id: string;
}

export type GetFileResult = File;

export interface GetChatMemberParams {
  chat_id: number | string;
  user_id: number;
}

export type GetChatMemberResult = ChatMember;

export type TelegramApiMethod =
  | 'sendMessage'
  | 'sendPhoto'
  | 'sendVoice'
  | 'editMessageText'
  | 'deleteMessage'
  | 'deleteMessages'
  | 'setMyCommands'
  | 'getFile'
  | 'getChatMember';

export interface ApiSuccessResponse<T> {
  ok: true;
  result: T;
}

export interface ApiErrorResponse {
  ok: false;
  error_code: number;
  description: string;
}

export type TelegramApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
