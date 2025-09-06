// src/utils/http_client.ts

import { Log } from '@/services';

// --------------------------------------------------------------------------
// |                           核心类型定义                                 |
// --------------------------------------------------------------------------

/**
 * @type FetchBody
 * @description 为 fetch API 的 body 参数定义一个可移植的类型。
 *              包含了在浏览器和 Node.js 环境中常见的请求体类型。
 */
export type FetchBody = string | Blob | ArrayBuffer | FormData | URLSearchParams;

export type ResponseType = 'json' | 'text' | 'arrayBuffer' | 'response';

export interface HttpClientResponse<T = unknown> {
  data: T | null;
  ok: boolean;
  status: number;
  statusText: string;
  error?: HttpError | Error;
}

export interface CustomRequestOptions extends Omit<RequestInit, 'body'> {
  responseType?: ResponseType;
  queryParams?: Record<string, unknown>;
  /**
   * 请求体。推荐使用 `Body` 辅助工具创建 (如 `Body.json(...)`)，
   * 或直接传递 fetch API 支持的原始类型。
   */
  body?: CustomBody | FetchBody;
  timeout?: number;
}

export class HttpError extends Error {
  public readonly response: Response;
  public readonly status: number;
  public readonly statusText: string;

  constructor(message: string, response: Response) {
    super(message);
    this.name = 'HttpError';
    this.response = response;
    this.status = response.status;
    this.statusText = response.statusText;
  }
}

// --------------------------------------------------------------------------
// |                    请求体 (Body) 辅助模块                             |
// --------------------------------------------------------------------------

abstract class CustomBody {
  public abstract get body(): FetchBody;
  public abstract get headers(): Record<string, string>;
}

class JsonBody extends CustomBody {
  private readonly payload: Record<string, unknown>;

  constructor(payload: Record<string, unknown>) {
    super();
    this.payload = payload;
  }

  public get body(): FetchBody {
    return JSON.stringify(this.payload);
  }

  public get headers(): Record<string, string> {
    return { 'Content-Type': 'application/json;charset=UTF-8' };
  }
}

class FormDataBody extends CustomBody {
  private readonly formData: FormData;

  constructor(formData: FormData) {
    super();
    this.formData = formData;
  }

  public get body(): FetchBody {
    return this.formData;
  }

  public get headers(): Record<string, string> {
    return {};
  }
}

const Body = {
  json: (payload: Record<string, unknown>): CustomBody => new JsonBody(payload),
  formData: (formData: FormData): CustomBody => new FormDataBody(formData),
};

// --------------------------------------------------------------------------
// |                        HttpClient 核心实现                             |
// --------------------------------------------------------------------------

/**
 * @class HttpClient
 * @description 为沙箱环境提供一个受控、强大且安全的无状态网络请求客户端。
 */
export class HttpClient {
  private readonly DEFAULT_TIMEOUT = 60000;

  public async request<T = unknown>(url: string, options: CustomRequestOptions = {}): Promise<HttpClientResponse<T>> {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      const error = new TypeError('HttpClient Error: URL 必须是一个有效的绝对路径 (以 http:// 或 https:// 开头)。');
      return { data: null, ok: false, status: 0, statusText: '客户端错误', error };
    }

    const { responseType = 'json', queryParams, body: originalBody, timeout, ...restOptions } = options;
    const fetchOptions: RequestInit = { ...restOptions };

    const finalUrl = this.buildUrlWithParams(url, queryParams);

    const userHeaders = (restOptions.headers as Record<string, string> | undefined) || {};
    let bodyHeaders = {};

    if (originalBody instanceof CustomBody) {
      fetchOptions.body = originalBody.body;
      bodyHeaders = originalBody.headers;
    } else {
      fetchOptions.body = originalBody as FetchBody;
    }

    fetchOptions.headers = { ...bodyHeaders, ...userHeaders };

    const controller = new AbortController();
    const timeoutDuration = timeout ?? this.DEFAULT_TIMEOUT;
    const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);
    fetchOptions.signal = controller.signal;

    Log.info(`[HttpClient] 发起请求: ${fetchOptions.method || 'GET'} ${finalUrl}`);

    try {
      const response = await fetch(finalUrl, fetchOptions);
      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = new HttpError(`HTTP 请求失败，状态码: ${response.status}`, response);
        return { data: null, ok: false, status: response.status, statusText: response.statusText, error };
      }

      const data = await this.processResponse<T>(response, responseType);
      return { data, ok: true, status: response.status, statusText: response.statusText };
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      const err = error instanceof Error ? error : new Error('未知网络错误');
      return { data: null, ok: false, status: 0, statusText: '客户端错误', error: err };
    }
  }

  public get<T = unknown>(url: string, options: Omit<CustomRequestOptions, 'body' | 'method'> = {}): Promise<HttpClientResponse<T>> {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  public post<T = unknown>(
    url: string,
    body?: CustomBody | FetchBody,
    options: Omit<CustomRequestOptions, 'body' | 'method'> = {},
  ): Promise<HttpClientResponse<T>> {
    return this.request<T>(url, { ...options, method: 'POST', body });
  }

  public put<T = unknown>(
    url: string,
    body?: CustomBody | FetchBody,
    options: Omit<CustomRequestOptions, 'body' | 'method'> = {},
  ): Promise<HttpClientResponse<T>> {
    return this.request<T>(url, { ...options, method: 'PUT', body });
  }

  public patch<T = unknown>(
    url: string,
    body?: CustomBody | FetchBody,
    options: Omit<CustomRequestOptions, 'body' | 'method'> = {},
  ): Promise<HttpClientResponse<T>> {
    return this.request<T>(url, { ...options, method: 'PATCH', body });
  }

  public delete<T = unknown>(url: string, options: Omit<CustomRequestOptions, 'body' | 'method'> = {}): Promise<HttpClientResponse<T>> {
    return this.request<T>(url, { ...options, method: 'DELETE' });
  }

  private buildUrlWithParams(url: string, queryParams?: Record<string, unknown>): string {
    if (!queryParams) return url;
    const urlObject = new URL(url);
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        urlObject.searchParams.append(key, String(value));
      }
    });
    return urlObject.toString();
  }

  private async processResponse<T>(response: Response, responseType: ResponseType): Promise<T> {
    switch (responseType) {
      case 'json': {
        const text = await response.text();
        if (!text) return null as unknown as T;
        try {
          return JSON.parse(text) as T;
        } catch {
          throw new Error(`HttpClient Error: 无法将响应解析为 JSON。`);
        }
      }
      case 'text':
        return response.text() as unknown as T;
      case 'arrayBuffer':
        return response.arrayBuffer() as unknown as T;
      case 'response':
        return response as unknown as T;
      default:
        throw new Error(`HttpClient Error: 无效的 responseType '${responseType}'。`);
    }
  }
}

const Http: HttpClient = new HttpClient();

interface CustomUtils {
  Http: typeof Http;
  Body: typeof Body;
}

export const Utils: CustomUtils = {
  Http,
  Body,
};
