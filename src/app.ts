import { SERVER_BODY_LIMIT } from '@shared/core/constants.js';
import { logger } from '@shared/core/logger.js';
import { ms } from '@shared/utils/helpers.js';
import { fastify, type FastifyInstance } from 'fastify';

/**
 * @description 构建 Fastify 应用程序实例
 */
const buildApp = (): FastifyInstance => {
  const app = fastify({
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
    bodyLimit: SERVER_BODY_LIMIT,
    keepAliveTimeout: ms.min(5),
  });

  app.get('/ping', async (_req, rep) => {
    rep.code(200).type('application/json').send({ code: 200, message: `It's worked` });
  });

  app.setNotFoundHandler(async (_req, rep) => {
    rep.code(404).type('application/json').send({ code: 404, message: 'Not Found' });
  });

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

export default buildApp;
