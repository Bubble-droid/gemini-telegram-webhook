import { config, logger } from '@/services';
import type { InferSchema, JSONSchema } from '@/types';
import { KeyRotator } from '@/utils';
import type { FastifyInstance, RawRequestDefaultExpression } from 'fastify';

const ProxyHeadersSchema = {
  type: 'object',
  properties: {
    'x-goog-api-key': { type: 'string' },
    'content-type': { type: 'string', const: 'application/json' },
  },
  required: ['x-goog-api-key', 'content-type'],
  additionalProperties: true,
} as const satisfies JSONSchema;

type TProxyHeaders = RawRequestDefaultExpression['headers'] & InferSchema<typeof ProxyHeadersSchema>;

const isLocalRequest = (ip: string): boolean => {
  return ['127.0.0.1', '::1', 'localhost'].includes(ip);
};

export const registerProxyRoute = (app: FastifyInstance): void => {
  const keyRotator = new KeyRotator();

  app.all<{ Headers: TProxyHeaders }>('/gemini/*', {
    schema: {
      headers: ProxyHeadersSchema,
    },

    handler: async (req, rep) => {
      try {
        if (!isLocalRequest(req.ip)) {
          rep.code(403).type('application/json').send({ error: 'Forbidden' });
          return;
        }
        // 2. URL 重组
        const originalPath = req.url.replace(/^\/gemini/, '');
        const targetUrl = new URL(originalPath, config.geminiApiBaseUrl);

        // 3. Header 处理 (关键步骤)
        const headers = new Headers();

        // 3.1 复制原始请求的所有 Header
        const reqHeaders = req.headers;
        for (const [key, value] of Object.entries(reqHeaders)) {
          if (value) headers.set(key, value as string);
        }

        // 3.2 移除这几个 Header，因为 node-fetch/undici 会自动生成，透传会导致 SSL 或 协议错误
        headers.delete('host');
        headers.delete('connection');
        headers.delete('content-length');
        headers.delete('transfer-encoding');

        // 3.3 核心：注入/覆盖 API Key
        // 无论 SDK 发来什么 Key，这里强制替换为轮换后的新 Key
        const rotatedKey = keyRotator.nextKey();
        headers.set('x-goog-api-key', rotatedKey); // Header 鉴权方式

        // 5. 发起上游请求
        logger.debug(
          `🔄 代理转发 -> Google | Key: ${rotatedKey.substring(0, 5)}...${rotatedKey.substring(rotatedKey.length - 5)} | Path: ${targetUrl.pathname}`,
        );

        logger.debug(`Body Forwarding:`, { body: req.body });

        const upstreamResponse = await fetch(targetUrl.toString(), {
          method: req.method,
          headers,
          redirect: 'follow',
          body: JSON.stringify(req.body),
        });

        // 6. 响应透传
        // 将 Google 的状态码和 Header 传回给本地客户端
        rep.code(upstreamResponse.status);

        upstreamResponse.headers.forEach((val, key) => {
          // 过滤掉一些可能引起下游解析错误的 Header
          if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(key)) {
            void rep.header(key, val);
          }
        });

        // 获取响应内容并返回
        // arrayBuffer() 比 text() 更安全，支持二进制数据（虽然 Gemini 主要是 JSON）
        const buffer = await upstreamResponse.arrayBuffer();
        rep.send(Buffer.from(buffer));
      } catch (err) {
        logger.error('❌ Gemini Proxy Error', { err });
        rep.code(502).send({
          error: 'Bad Gateway',
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  });
};
