import { TELEGRAPH_BASE_URL } from '@shared/core/constants.js';
import { TelegraphError } from '@shared/core/errors.js';
import { decodeToString } from '@shared/utils/helpers.js';
import { httpRequest } from '@shared/utils/http.js';
import type {
  Account,
  CreateAccountParams,
  CreatePageParams,
  EditAccountInfoParams,
  EditPageParams,
  GetAccountInfoParams,
  GetPageListParams,
  GetPageParams,
  GetViewsParams,
  Page,
  PageList,
  PageViews,
  RevokeAccessTokenParams,
  TelegraphApiMethods,
  TelegraphResponse,
} from './types.js';

type ApiMethod = keyof TelegraphApiMethods;
type ApiParams<M extends ApiMethod> = Parameters<TelegraphApiMethods[M]>[0];
type ApiResult<M extends ApiMethod> = Awaited<ReturnType<TelegraphApiMethods[M]>>;

export class TelegraphApiClient implements TelegraphApiMethods {
  private readonly baseUrl = TELEGRAPH_BASE_URL;
  private accessToken: string;
  private accountInfo: Account;

  constructor(accountJsonEncoded: string) {
    try {
      this.accountInfo = JSON.parse(decodeToString(accountJsonEncoded)) as Account;
    } catch (err) {
      throw new TelegraphError(`Invalid account JSON format. ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    if (!this.accountInfo.access_token) {
      throw new TelegraphError(
        'Authentication required: No access_token set. Call createAccount or provide token in constructor.',
      );
    }
    this.accessToken = this.accountInfo.access_token;
  }

  // ==========================================
  // Account Methods
  // ==========================================

  public async createAccount(params: CreateAccountParams): Promise<Account> {
    const result = await this.request('createAccount', params);
    if (result.access_token) {
      this.accessToken = result.access_token;
      this.accountInfo = result;
    }
    return result;
  }

  public async editAccountInfo(params: EditAccountInfoParams): Promise<Account> {
    const result = await this.request('editAccountInfo', { access_token: this.accessToken, ...params });
    this.accountInfo = { ...this.accountInfo, ...result };
    return result;
  }

  public getAccountInfo(params: GetAccountInfoParams): Promise<Account> {
    return this.request('getAccountInfo', { access_token: this.accessToken, ...params });
  }

  public async revokeAccessToken(params: RevokeAccessTokenParams): Promise<Account> {
    const result = await this.request('revokeAccessToken', { access_token: this.accessToken, ...params });
    if (result.access_token) {
      this.accessToken = result.access_token;
    }
    return result;
  }

  // ==========================================
  // Page Methods
  // ==========================================

  public createPage(params: CreatePageParams): Promise<Page> {
    return this.request('createPage', {
      access_token: this.accessToken,
      author_name: this.accountInfo.author_name,
      ...params,
    });
  }

  public editPage(params: EditPageParams): Promise<Page> {
    return this.request('editPage', {
      access_token: this.accessToken,
      author_name: this.accountInfo.author_name,
      ...params,
    });
  }

  public getPage(params: GetPageParams): Promise<Page> {
    return this.request('getPage', params);
  }

  public getPageList(params: GetPageListParams): Promise<PageList> {
    return this.request('getPageList', { access_token: this.accessToken, ...params });
  }

  public getViews(params: GetViewsParams): Promise<PageViews> {
    return this.request('getViews', params);
  }

  /**
   * Internal helper to make API requests.
   */
  private async request<T extends ApiMethod>(method: T, payload: ApiParams<T>): Promise<ApiResult<T>> {
    const url = this.getUrl(method);

    const response = await httpRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      responseType: 'json',
    });

    const data = response.data as unknown as TelegraphResponse<ApiResult<T>>;

    if (!data.ok) {
      throw new TelegraphError(data.error);
    }

    return data.result;
  }

  private getUrl(method: ApiMethod): string {
    return `${this.baseUrl}/${method}`;
  }
}
