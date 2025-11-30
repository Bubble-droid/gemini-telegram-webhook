// src/route.ts

import { updateHandler } from '@/handlers';
import { config, logger } from '@/services';
import type { RequestSchema, Update } from '@/types';
import type { FastifyInstance, FastifySchema } from 'fastify';
import crypto from 'node:crypto';

const RequestHeadersSchema: RequestSchema = {
  type: 'object',
  properties: {
    'content-type': { type: 'string', const: 'application/json' },
    'x-telegram-bot-api-secret-token': { type: 'string' },
  },
  required: ['content-type', 'x-telegram-bot-api-secret-token'],
  additionalProperties: true,
};

const RequestBodySchema: RequestSchema = {
  type: 'object',
  properties: {
    update_id: { type: 'number' },
  },
  required: ['update_id'],
  additionalProperties: true,
};

const routeSchema: FastifySchema = {
  body: RequestBodySchema,
  headers: RequestHeadersSchema,
};

/**
 * 安全的恒定时间字符串比较
 * 防止时序攻击 (Timing Attacks)
 */
const safeCompare = (a: string, b: string): boolean => {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    // timingSafeEqual 要求 Buffer 长度必须相等，否则抛错
    // 因此我们需要先判断长度，但为了防止通过长度推测，长度判断也应尽量隐晦（虽然 Webhook 场景下长度通常固定）
    return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
};

/**
 * @description 为 Fastify 应用程序创建和注册所有路由
 * @param route - Fastify 应用程序实例
 */
export const mainRoutes = (route: FastifyInstance): void => {
  // 2. 健康检查接口
  route.get('/', async (_request, reply) => {
    return reply.code(200).type('application/json').send({ code: 200, message: `It's worked` });
  });

  // 3. Telegram Webhook 接口
  route.post('/webhook', {
    schema: routeSchema,

    // 验证逻辑
    preHandler: async (request, reply) => {
      // 日志脱敏
      const safeHeaders = { ...request.headers, 'x-telegram-bot-api-secret-token': '***' };
      logger.info('Webhook Request Headers', { headers: safeHeaders });

      // 获取 Header，处理数组情况 (防御性编程)
      const tokenHeader = request.headers['x-telegram-bot-api-secret-token'];
      const secretTokenFromHeader = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader || '';

      // 安全校验
      if (!safeCompare(secretTokenFromHeader, config.secretToken)) {
        logger.warn('Unauthorized webhook access attempt', {
          clientIp: request.headers['x-real-ip'], // 确保 app.ts 中开启了 trustProxy
          userAgent: request.headers['user-agent'],
        });

        // 发送 401 并结束请求
        return reply.code(401).type('application/json').send({ code: 401, message: 'Bad Credentials' });
      }
    },

    // 业务逻辑
    handler: async (request, reply) => {
      logger.info('Webhook Verification successful');
      const update = request.body as Update;

      // 关键策略：Fire and Forget (触发即忘)
      // 我们不等待 updateHandler 完成，而是立即返回 202 给 Telegram，防止超时
      updateHandler.handle(update).catch((err) => {
        logger.error('Error handling update asynchronously', { err });
      });

      return reply.code(202).type('application/json').send({ code: 202, message: `OK` });
    },
  });

  // 4. 404 处理 (可选，Fastify 默认有 JSON 404，但自定义更统一)
  route.setNotFoundHandler(async (_request, reply) => {
    return reply.code(404).type('application/json').send({ code: 404, message: 'Not Found' });
  });
};
