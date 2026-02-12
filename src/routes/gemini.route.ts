import { handleGeminiProxyRequest } from '@proxy/gemini/handle-gemini-request.js';
import type { GenerateContentRequest } from '@proxy/types.js';
import { CONFIG } from '@shared/core/config.js';
import { shuffleArray } from '@shared/utils/helpers.js';
import { ListRotator } from '@shared/utils/list-rotator.js';
import type { FastifyInstance } from 'fastify';
import { checkAuthToken, checkIpWhitelist } from './guards.js';
import { ProxyHeadersSchema } from './route-schema.js';

export const registerGeminiProxyRoute = (app: FastifyInstance) => {
  const keyRotator = new ListRotator(shuffleArray(CONFIG.GEMINI_API_KEYS));
  app.route<GenerateContentRequest>({
    method: 'POST',
    url: '/gemini/v1beta/models/:modelAndMethod',
    schema: { headers: ProxyHeadersSchema },
    preHandler: [checkIpWhitelist, checkAuthToken('x-goog-api-key')],
    handler: handleGeminiProxyRequest(keyRotator),
  });
};
