// src/app.ts

import Fastify, { type FastifyInstance } from 'fastify';
import createRoutes from '@/route';
import { BotConfig, initLogger, loggerAdapter } from '@/services';

/**
 * @function buildApp
 * @description 构建 Fastify 应用程序实例。
 *              根据运行环境（Vercel 或本地）注册路由。
 * @returns {Promise<FastifyInstance>} 配置好的 Fastify 应用程序实例。
 */
const buildApp = async (): Promise<FastifyInstance> => {
  const { loggerLevel } = BotConfig.load();
  initLogger({ loggerLevel });
  const app: FastifyInstance = Fastify({
    logger: {
      level: loggerLevel,
      stream: loggerAdapter,
    },
  });
  if (process.env.VERCEL && process.env.VERCEL === '1') {
    await app.register(createRoutes);
  } else {
    await createRoutes(app);
  }
  return app;
};

export default buildApp;
