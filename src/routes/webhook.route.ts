import { CONFIG } from '@shared/core/config';
import { logger } from '@shared/core/logger';
import type { InferSchema, JSONSchema } from '@shared/types/schema';
import type { UpdateHandler } from '@telegram/handlers/update-handler';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Update } from 'grammy/types';

const WebhookBodySchema = {
  type: 'object',
  properties: {
    update_id: { type: 'number' },
    message: {
      type: 'object',
      additionalProperties: true,
    },
    edited_message: {
      type: 'object',
      additionalProperties: true,
    },
    callback_query: {
      type: 'object',
      additionalProperties: true,
    },
  },
  required: ['update_id'],
  additionalProperties: true,
} as const satisfies JSONSchema;

const WebhookHeadersSchema = {
  type: 'object',
  properties: {
    'x-telegram-bot-api-secret-token': { type: 'string', const: CONFIG.WEBHOOK_SECRET_TOKEN },
    'content-type': { type: 'string', const: 'application/json' },
  },
  required: ['x-telegram-bot-api-secret-token', 'content-type'],
  additionalProperties: true,
} as const satisfies JSONSchema;

type TWebhookHeaders = FastifyRequest['headers'] & InferSchema<typeof WebhookHeadersSchema>;

/**
 * @description 为 Fastify 应用程序创建和注册所有路由
 * @param app - Fastify 应用程序实例
 */
export const registerWebhookRoute = (app: FastifyInstance, updateHandler: UpdateHandler): void => {
  app.route<{ Body: Update; Headers: TWebhookHeaders }>({
    method: 'POST',
    url: '/webhook',
    schema: {
      body: WebhookBodySchema,
      headers: WebhookHeadersSchema,
    },
    handler: async (req, rep) => {
      logger.info(`[Webhook] Incoming update authorized`, {
        updateId: req.body.update_id,
        type: req.body.message ? 'message' : 'other',
        remoteIp: req.ip,
      });
      void updateHandler.handle(req.body);

      rep.code(202).type('application/json').send({ code: 202, message: `Processing webhook` });
    },
  });
};
