import type { Recordable } from './common.js';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export type ResponseType = 'text' | 'json' | 'blob' | 'arrayBuffer';
export type ResponseBody<T extends ResponseType> = T extends 'text'
  ? string
  : T extends 'json'
    ? Recordable
    : T extends 'blob'
      ? Blob
      : T extends 'arrayBuffer'
        ? ArrayBuffer
        : never;

export interface RequestOpts<T extends ResponseType> extends Omit<RequestInit, 'method'> {
  method?: HttpMethod;
  responseType: T;
  timeout?: number;
}

export interface RequestResult<T extends ResponseType> {
  status: number;
  headers: Headers;
  data: ResponseBody<T>;
}
