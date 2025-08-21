// src/types/common.d.ts

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface RequestSchema {
  type: 'object';
  properties: {
    [key: string]: {
      type: 'string' | 'number' | 'boolean' | 'object' | 'array';
      [key: string]: unknown;
    };
  };
  required?: string[];
  additionalProperties?: boolean;
}
