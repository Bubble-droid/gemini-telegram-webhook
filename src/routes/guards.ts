import { CONFIG } from '@shared/core/config.js';
import { logger } from '@shared/core/logger.js';
import { verifyToken } from '@shared/utils/helpers.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const ALLOWED_IPS = ['127.0.0.1', '::1', 'localhost'];

const HEADER_ENV_MAP = {
  'x-telegram-bot-api-secret-token': 'WEBHOOK_SECRET_TOKEN',
  'x-goog-api-key': 'PROXY_AUTH_TOKEN',
} as const;

export const checkIpWhitelist = async (req: FastifyRequest, rep: FastifyReply) => {
  const clientIp = req.ip;
  if (!ALLOWED_IPS.includes(clientIp)) {
    logger.warn('Unauthorized IP access attempt', { clientIp });
    rep.code(403).send({
      error: 'Forbidden',
      message: 'Access denied from this IP address',
    });
  }
};

export const checkAuthToken = (headerKey: keyof typeof HEADER_ENV_MAP) => {
  return async (req: FastifyRequest, rep: FastifyReply) => {
    const clientIp = req.ip;
    const providedKey = req.headers[headerKey];
    const storeToken = CONFIG[HEADER_ENV_MAP[headerKey]];
    if (typeof providedKey !== 'string' || !verifyToken(providedKey, storeToken)) {
      logger.warn('Unauthorized Token access attempt', { clientIp });
      rep.code(401).send({
        error: 'Unauthorized',
        message: 'Access denied token invalid',
      });
    }
  };
};
