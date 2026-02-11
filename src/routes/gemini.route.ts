import { handleGeminiProxyRequest } from '@proxy/gemini/handle-gemini-request.js';
import type { FastifyInstance } from 'fastify';
import { checkAuthToken, checkIpWhitelist } from './guards.js';
import { ProxyHeadersSchema, type TProxyHeaders } from './route-schema.js';

export const registerGeminiProxyRoute = (app: FastifyInstance) => {
  app.route<{ Headers: TProxyHeaders }>({
    method: 'POST',
    url: '/gemini/v1beta/models/:modelAndMethod',
    schema: { headers: ProxyHeadersSchema },
    preHandler: [checkIpWhitelist, checkAuthToken('x-goog-api-key')],
    handler: handleGeminiProxyRequest,
  });
};
