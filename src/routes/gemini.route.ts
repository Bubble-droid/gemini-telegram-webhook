import { handleProxyRequest } from '@/services';
import type { InferSchema, JSONSchema } from '@/types';
import type { FastifyInstance, FastifyRequest } from 'fastify';

const ProxyHeadersSchema = {
  type: 'object',
  properties: {
    'x-goog-api-key': { type: 'string' },
    'content-type': { type: 'string' },
  },
  required: ['x-goog-api-key', 'content-type'],
  additionalProperties: true,
} as const satisfies JSONSchema;

type TProxyHeaders = FastifyRequest['headers'] & InferSchema<typeof ProxyHeadersSchema>;

export const registerProxyRoute = (app: FastifyInstance): void => {
  app.all<{ Headers: TProxyHeaders }>('/gemini/*', {
    schema: {
      headers: ProxyHeadersSchema,
    },

    handler: handleProxyRequest,
  });
};
