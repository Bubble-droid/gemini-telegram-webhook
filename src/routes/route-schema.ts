import type { InferSchema, JSONSchema } from '@shared/types/schema.js';

export const ProxyHeadersSchema = {
  type: 'object',
  properties: {
    'x-goog-api-key': { type: 'string' },
    'content-type': { type: 'string', const: 'application/json' },
  },
  required: ['x-goog-api-key', 'content-type'],
  additionalProperties: true,
} as const satisfies JSONSchema;

export type TProxyHeaders = InferSchema<typeof ProxyHeadersSchema>;

export const WebhookBodySchema = {
  type: 'object',
  properties: {
    update_id: { type: 'number' },
    message: {
      type: 'object',
      additionalProperties: true,
    },
    callback_query: {
      type: 'object',
      additionalProperties: true,
    },
  },
  required: ['update_id'],
  additionalProperties: true,
} as const satisfies JSONSchema;

export const WebhookHeadersSchema = {
  type: 'object',
  properties: {
    'x-telegram-bot-api-secret-token': { type: 'string' },
    'content-type': { type: 'string', const: 'application/json' },
  },
  required: ['x-telegram-bot-api-secret-token', 'content-type'],
  additionalProperties: true,
} as const satisfies JSONSchema;

export type TWebhookHeaders = InferSchema<typeof WebhookHeadersSchema>;
