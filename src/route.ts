// src/route.ts

import type { FastifyInstance, FastifyReply, FastifyRequest, FastifySchema } from 'fastify';
import { handleUpdate } from '@/handlers';
import { BotConfig, Log } from '@/services';
import type { RequestHeaders, RequestBody, Update, RequestSchema } from '@/types';

const RequestHeadersSchema: RequestSchema = {
  type: 'object',
  properties: {
    'content-type': {
      type: 'string',
      const: 'application/json',
    },
    'x-telegram-bot-api-secret-token': {
      type: 'string',
    },
  },
  required: ['content-type', 'x-telegram-bot-api-secret-token'],
  additionalProperties: true,
};

const RequestBodySchema: RequestSchema = {
  type: 'object',
  properties: {
    update_id: {
      type: 'number',
    },
  },
  required: ['update_id'],
  additionalProperties: true,
};

const routeSchema: FastifySchema = {
  body: RequestBodySchema,
  headers: RequestHeadersSchema,
};

/**
 * @function createRoutes
 * @description 为 Fastify 应用程序创建和注册所有路由。
 *              包括根路径的健康检查路由和处理 Telegram Webhook 的 POST 路由。
 * @param {FastifyInstance} route - Fastify 应用程序实例，用于注册路由。
 * @returns {Promise<void>}
 */
const createRoutes = async (route: FastifyInstance): Promise<void> => {
  // 定义 GET / 路由，用于健康检查或简单的服务说明
  route.get('/', (request: FastifyRequest, reply: FastifyReply): FastifyReply => {
    return reply.code(200).type('application/json').send({ code: 200, message: `It's worked` });
  });

  // 定义 POST /webhook 路由，用于接收 Telegram 的 Webhook 更新
  route.post<{ Body: RequestBody; Headers: RequestHeaders }>('/webhook', {
    schema: routeSchema,
    // preHandler 钩子在路由处理函数执行前运行，用于身份验证等预处理逻辑
    preHandler: async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply | void> => {
      const { secretToken } = BotConfig.load();
      Log.info('Webhook Request Headers', { headers: request.headers });
      const secretTokenFromHeader = request.headers['x-telegram-bot-api-secret-token'] || '';
      if (!secretTokenFromHeader || secretTokenFromHeader !== secretToken) {
        Log.warn('Unauthorized webhook access attempt', { clientIp: request.ip });
        return reply.code(401).type('application/json').send({ code: 401, message: 'Bad Credentials' });
      }
    },
    handler: async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
      Log.info('Webhook Verification successful');
      setImmediate(() => {
        void handleUpdate(request.body as Update);
      });
      return reply.code(202).type('application/json').send({ code: 202, message: `OK` });
    },
  });

  // 定义 404 Not Found 处理器，处理所有未匹配的路由
  route.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply): FastifyReply => {
    return reply.code(404).type('application/json').send({ code: 404, message: 'Not Found' });
  });
};

export default createRoutes;
