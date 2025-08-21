// src/man.ts

import type { VercelRequest, VercelResponse } from '@vercel/node';
import buildApp from '@/app';
import type { FastifyInstance } from 'fastify';
import { AppError, Log } from '@/services';

/**
 * @function handler
 * @description Vercel Serverless Function 的入口点。
 *              此函数负责在无服务器环境中加载配置，初始化日志和核心业务服务，
 *              然后构建 Fastify 应用程序并处理来自 Vercel 的 HTTP 请求。
 * @param {VercelRequest} req - Vercel 提供的请求对象。
 * @param {VercelResponse} res - Vercel 提供的响应对象。
 * @returns {Promise<void>} 此函数不返回任何值，通过 res 对象直接发送响应。
 */
const handler = async (req: VercelRequest, res: VercelResponse): Promise<void> => {
  const app: FastifyInstance = await buildApp();
  try {
    await app.ready();
    app.server.emit('request', req, res);
  } catch (error) {
    Log.fatal('Internal Server Error', {
      err: error instanceof Error ? error.message : String(error),
    });
    throw new AppError('Internal Server Error', 'INTERNAL_SERVER_ERROR');
  }
};

export default handler;
