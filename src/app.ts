import { config, logger } from '@/services';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerProxyRoute, registerWebhookRoute } from './routes';
import { HOUR, MIN } from './utils';

/**
 * @description 构建 Fastify 应用程序实例
 */
export const buildApp = (): FastifyInstance => {
  const { logLevel } = config;

  logger.init({ logLevel });

  const app = Fastify({
    logger: {
      enabled: true,
      level: 'trace',
      redact: {
        paths: ['pid', 'hostname', 'time', 'responseTime'],
        remove: true,
      },
      serializers: {
        req(req) {
          const headers = {
            ...req.headers,
            ...(req.headers.authorization && { authorization: '***' }),
            ...(req.headers['x-telegram-bot-api-secret-token'] && { 'x-telegram-bot-api-secret-token': '***' }),
            ...(req.headers['x-goog-api-key'] && { 'x-goog-api-key': '***' }),
          };
          return {
            method: req.method,
            path: req.url,
            srcIp: req.ip,
            headers: headers,
          };
        },
      },
      stream: logger.stream,
    },
    trustProxy: true,
    bodyLimit: 104857600,
    connectionTimeout: 3 * MIN,
    keepAliveTimeout: 10 * MIN,
    requestTimeout: 1 * HOUR,
  });

  app.get('/ping', async (_req, rep) => {
    rep.code(200).type('application/json').send({ code: 200, message: `It's worked` });
  });

  app.setNotFoundHandler(async (_req, rep) => {
    rep.code(404).type('application/json').send({ code: 404, message: 'Not Found' });
  });

  registerWebhookRoute(app);

  if (config.enableKeyRotation) {
    registerProxyRoute(app);
  }

  app.setErrorHandler(async (error, _req, rep) => {
    let statusCode = 500;
    let message = 'Internal Server Error';
    let errorName = 'InternalServerError';

    if (error && typeof error === 'object' && 'statusCode' in error) {
      statusCode = error.statusCode as number;
    }

    if (error instanceof Error) {
      message = error.message;
      errorName = error.name;
    } else if (typeof error === 'string') {
      message = error;
    }

    logger.error(message, { code: statusCode, name: errorName });

    rep.code(statusCode).type('application/json').send({
      code: statusCode,
      name: errorName,
      message: message,
    });
  });

  return app;
};
