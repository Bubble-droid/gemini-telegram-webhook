import { mainRoutes, proxyRoutes } from '@/routes';
import { config, logger } from '@/services';
import Fastify, { type FastifyInstance } from 'fastify';

/**
 * @description 构建 Fastify 应用程序实例
 */
export const buildApp = (): FastifyInstance => {
  const { loggerLevel } = config;

  logger.init({ loggerLevel });

  const app = Fastify({
    logger: {
      level: 'trace',
      stream: logger.stream,
    },
    disableRequestLogging: false,
    trustProxy: true,
    bodyLimit: 10485760,
    connectionTimeout: 60000,
  });

  app.register(mainRoutes);

  if (config.enableKeyRotation) {
    app.register(proxyRoutes);
  }

  app.setErrorHandler((error, _request, reply) => {
    let statusCode = 500;
    let message = 'Internal Server Error';
    let errorName = 'InternalServerError';

    if (typeof error === 'object' && error !== null && 'statusCode' in error) {
      statusCode = error.statusCode as number;
    }

    if (error instanceof Error) {
      message = error.message;
      errorName = error.name;
    } else if (typeof error === 'string') {
      message = error;
    }

    if (statusCode >= 500) {
      logger.error(message, { err: error });
      message = 'Internal Server Error';
    }

    reply.code(statusCode).send({
      code: statusCode,
      error: errorName,
      message: message,
    });
  });

  return app;
};
