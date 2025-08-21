// src/types/kv_namespace.d.ts

export interface ValueActionBaseParams {
  namespaceId: string;
  keyName: string;
}

export interface ValueActionUpdateParams extends ValueActionBaseParams {
  value: string;
  expiration_ttl?: number;
}

export type ValueAction = 'get' | 'update' | 'delete';
