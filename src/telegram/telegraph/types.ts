import type { Integer } from '@shared/types/telegram.js';

interface AccessToken {
  access_token: string;
}

export interface Account extends Partial<AccessToken> {
  short_name: string;
  author_name: string;
  author_url: string;
  auth_url?: string;
  page_count?: number;
}

export interface PageList {
  total_count: Integer;
  pages: Page[];
}

export interface Page {
  path: string;
  url: string;
  title: string;
  description: string;
  author_name?: string;
  author_url?: string;
  image_url?: string;
  content?: Node[];
  views: Integer;
  can_edit?: boolean;
}

export interface PageViews {
  views: Integer;
}

export type Node = string | NodeElement;

export interface NodeElement {
  tag: AvailableTag;
  attrs?: ElementAttributes;
  children?: Node[];
}

export type AvailableTag =
  | 'a'
  | 'aside'
  | 'b'
  | 'blockquote'
  | 'br'
  | 'code'
  | 'em'
  | 'figcaption'
  | 'figure'
  | 'h3'
  | 'h4'
  | 'hr'
  | 'i'
  | 'iframe'
  | 'img'
  | 'li'
  | 'ol'
  | 'p'
  | 'pre'
  | 's'
  | 'strong'
  | 'u'
  | 'ul'
  | 'video';

export interface ElementAttributes {
  [key: string]: string | undefined;
  href?: string;
  src?: string;
}

export interface TelegraphResponseSuccess<T> {
  ok: true;
  result: T;
}

export interface TelegraphResponseError {
  ok: false;
  error: string;
}

export type TelegraphResponse<T> = TelegraphResponseSuccess<T> | TelegraphResponseError;

// Method Parameter Types
export interface CreateAccountParams {
  short_name: string;
  author_name?: string;
  author_url?: string;
}

export interface EditAccountInfoParams extends Partial<AccessToken> {
  short_name?: string;
  author_name?: string;
  author_url?: string;
}

export interface GetAccountInfoParams extends Partial<AccessToken> {
  /**
   * @default ['short_name','author_name','author_url']
   */
  fields?: ('short_name' | 'author_name' | 'author_url' | 'auth_url' | 'page_count')[];
}

export type RevokeAccessTokenParams = Partial<AccessToken>;

export interface CreatePageParams extends Partial<AccessToken> {
  title: string;
  author_name?: string;
  author_url?: string;
  content: Node[];
  /**
   * @default false
   */
  return_content?: boolean;
}

export interface EditPageParams extends Partial<AccessToken> {
  path: string;
  title: string;
  content: Node[];
  author_name?: string;
  author_url?: string;
  /**
   * @default false
   */
  return_content?: boolean;
}

export interface GetPageParams {
  path: string;
  /**
   * @default false
   */
  return_content?: boolean;
}

export interface GetPageListParams extends Partial<AccessToken> {
  /**
   * @default 0
   */
  offset?: Integer;
  /**
   * @default 50
   */
  limit?: Integer;
}

export interface GetViewsParams {
  path: string;
  /**
   * @example 2000-2100
   */
  year?: Integer;
  /**
   * @example 1-12
   */
  month?: Integer;
  /**
   * @example 1-31
   */
  day?: Integer;
  /**
   * @example 0-24
   */
  hour?: Integer;
}

export interface TelegraphApiMethods {
  createAccount(params: CreateAccountParams): Promise<Account>;
  editAccountInfo(params: EditAccountInfoParams): Promise<Account>;
  getAccountInfo(params: GetAccountInfoParams): Promise<Account>;
  revokeAccessToken(params: RevokeAccessTokenParams): Promise<Account>;
  createPage(params: CreatePageParams): Promise<Page>;
  editPage(params: EditPageParams): Promise<Page>;
  getPage(params: GetPageParams): Promise<Page>;
  getPageList(params: GetPageListParams): Promise<PageList>;
  getViews(params: GetViewsParams): Promise<PageViews>;
}
