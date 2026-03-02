import type { Update } from '@grammyjs/types';
import { logger } from '@shared/core/logger.js';
import type { UpdateHandler } from '@telegram/handlers/update-handler.js';
import type { FastifyInstance } from 'fastify';
import { checkAuthToken } from './guards.js';
import { WebhookBodySchema, WebhookHeadersSchema, type TWebhookHeaders } from './route-schema.js';

/**
 * @description 为 Fastify 应用程序创建和注册所有路由
 * @param app - Fastify 应用程序实例
 */
export const registerWebhookRoute = (app: FastifyInstance, updateHandler: UpdateHandler) => {
  app.route<{ Body: Update; Headers: TWebhookHeaders }>({
    method: 'POST',
    url: '/webhook',
    schema: {
      body: WebhookBodySchema,
      headers: WebhookHeadersSchema,
    },

    preHandler: [checkAuthToken('x-telegram-bot-api-secret-token')],

    handler: async (req, rep) => {
      logger.info(`[Webhook] Incoming update authorized`, {
        updateId: req.body.update_id,
        type: req.body.message ? 'message' : 'other',
        remoteIp: req.ip,
      });
      rep.code(202).type('application/json').send({ code: 202, message: `Processing webhook` });
      void updateHandler.handleUpdate(req.body);
    },
  });
};
