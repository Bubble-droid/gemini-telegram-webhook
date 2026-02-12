import { GoogleAuthClient } from '@proxy/cli/auth.js';
import { GeminiCliClient } from '@proxy/cli/gemini-cli-client.js';
import { handleCliProxyRequest } from '@proxy/cli/handle-cli-request.js';
import type { GenerateContentRequest } from '@proxy/types.js';
import { CONFIG } from '@shared/core/config.js';
import { GEMINI_TEXT_MODELS, OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET } from '@shared/core/constants.js';
import { ParseError } from '@shared/core/errors.js';
import { logger } from '@shared/core/logger.js';
import { decodeToString, shuffleArray } from '@shared/utils/helpers.js';
import { ListRotator } from '@shared/utils/list-rotator.js';
import type { FastifyInstance } from 'fastify';
import type { Credentials } from 'google-auth-library';
import { checkAuthToken, checkIpWhitelist } from './guards.js';
import { ProxyHeadersSchema } from './route-schema.js';

export const registerCliProxyRoute = (app: FastifyInstance) => {
  let creds: Credentials | null = null;
  try {
    const credsJson = decodeToString(CONFIG.GEMINI_CREDENTIALS);
    creds = JSON.parse(credsJson) as Credentials;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error('Failed to parse GEMINI_CREDENTIALS:', { err: errMsg });
    throw new ParseError(`Invalid format for GEMINI_CREDENTIALS environment variable: ${errMsg}`);
  }

  const clientId = decodeToString(OAUTH_CLIENT_ID);
  const clientSecret = decodeToString(OAUTH_CLIENT_SECRET);
  const authClient = new GoogleAuthClient(clientId, clientSecret, creds);
  const cliClient = new GeminiCliClient(authClient);

  const modelRotator = new ListRotator(shuffleArray(GEMINI_TEXT_MODELS));

  app.route<GenerateContentRequest>({
    method: 'POST',
    url: '/cli/v1beta/models/:modelAndMethod',
    schema: { headers: ProxyHeadersSchema },
    preHandler: [checkIpWhitelist, checkAuthToken('x-goog-api-key')],
    handler: handleCliProxyRequest(cliClient, modelRotator),
  });
};
