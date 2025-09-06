// src/types/kv_namespace.d.ts

export interface ValueBaseParams {
  namespaceId: string;
  keyName: string;
}

export interface ValueUpdateActionParams {
  value: string;
  options?: {
    expiration?: number;
    expiration_ttl?: number;
    metadata?: unknown;
  };
}

export type ValueAction = 'get' | 'update' | 'delete';
