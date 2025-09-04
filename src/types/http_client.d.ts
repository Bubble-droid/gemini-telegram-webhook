// src/types/http_client.d.ts

/**
 * @file httpClient.d.ts
 * @description 为脚本沙箱环境中注入的全局 `httpClient` 对象提供类型定义。
 */

// --------------------------------------------------------------------------
// |                         核心类型定义                                   |
// --------------------------------------------------------------------------

/**
 * @type FetchBody
 * @description 为 fetch API 的 body 参数定义一个可移植的类型。
 */
type FetchBody = string | Blob | ArrayBuffer | FormData | URLSearchParams;

type ResponseType = 'json' | 'text' | 'arrayBuffer' | 'response';

interface HttpError extends Error {
  readonly response: Response;
  readonly status: number;
  readonly statusText: string;
}

interface HttpClientResponse<T = unknown> {
  data: T | null;
  ok: boolean;
  status: number;
  statusText: string;
  error?: HttpError | Error;
}

// --------------------------------------------------------------------------
// |                         请求体 (Body) 类型                              |
// --------------------------------------------------------------------------

/**
 * @interface CustomBody
 * @description 一个不透明的类型，代表一个由 Body 工厂创建的请求体。
 */
declare abstract class CustomBody {
  private _brand: 'CustomBody';
}

/**
 * @namespace Body
 * @description 一个工厂对象，用于创建不同类型的请求体。
 */
declare namespace Body {
  /**
   * 创建一个 'application/json' 类型的请求体。
   * @param payload - 将被序列化为 JSON 字符串的 JavaScript 对象。
   */
  function json(payload: Record<string, unknown>): CustomBody;

  /**
   * 创建一个 'multipart/form-data' 类型的请求体。
   * @param formData - 一个 FormData 实例。
   */
  function formData(formData: FormData): CustomBody;
}

// --------------------------------------------------------------------------
// |                         客户端接口定义                                 |
// --------------------------------------------------------------------------

interface CustomRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';
  headers?: Record<string, string>;
  queryParams?: Record<string, unknown>;
  /**
   * 请求体。推荐使用 `Body` 辅助工具创建 (如 `Body.json(...)`)，
   * 或直接传递 fetch API 支持的原始类型。
   */
  body?: CustomBody | FetchBody;
  responseType?: ResponseType;
  timeout?: number;
  [key: string]: unknown;
}

interface ISandboxHttpClient {
  request<T = unknown>(url: string, options?: CustomRequestOptions): Promise<HttpClientResponse<T>>;

  get<T = unknown>(url: string, options?: Omit<CustomRequestOptions, 'body' | 'method'>): Promise<HttpClientResponse<T>>;

  post<T = unknown>(
    url: string,
    body?: CustomBody | FetchBody,
    options?: Omit<CustomRequestOptions, 'body' | 'method'>,
  ): Promise<HttpClientResponse<T>>;

  put<T = unknown>(
    url: string,
    body?: CustomBody | FetchBody,
    options?: Omit<CustomRequestOptions, 'body' | 'method'>,
  ): Promise<HttpClientResponse<T>>;

  patch<T = unknown>(
    url: string,
    body?: CustomBody | FetchBody,
    options?: Omit<CustomRequestOptions, 'body' | 'method'>,
  ): Promise<HttpClientResponse<T>>;

  delete<T = unknown>(url: string, options?: Omit<CustomRequestOptions, 'body' | 'method'>): Promise<HttpClientResponse<T>>;
}

/**
 * @const httpClient
 * @description 一个全局可用的网络请求客户端实例。
 */
declare const Http: ISandboxHttpClient;
