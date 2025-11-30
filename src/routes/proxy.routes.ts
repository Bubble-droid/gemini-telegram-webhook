import { config, logger } from '@/services';
import { keyRotator } from '@/utils';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

/**
 * 判定是否为本地回环请求 (安全卫士)
 */
const isLocalRequest = (req: FastifyRequest): boolean => {
  const ip = req.ip;
  return ip === '127.0.0.1' || ip === '::1' || ip === 'localhost';
};

export const proxyRoutes = (route: FastifyInstance) => {
  // 拦截 /gemini/* 的所有请求 (GET, POST 等)
  route.all('/gemini/*', async (request: FastifyRequest, reply: FastifyReply) => {
    // 1. 安全检查
    if (!isLocalRequest(request)) {
      logger.warn(`🚫 拒绝外部访问代理: ${request.ip}`);
      return reply.code(403).send({ error: 'Forbidden: Local Access Only' });
    }

    // logger.debug(`Original Request Headers:`, { headers: request.headers });

    try {
      // 2. URL 重组
      const originalPath = request.url.replace(/^\/gemini/, '');
      const targetUrl = new URL(originalPath, config.geminiApiBaseUrl);

      // 3. Header 处理 (关键步骤)
      const headers = new Headers();

      // 3.1 复制原始请求的所有 Header
      const reqHeaders = request.headers as Record<string, string | undefined>;
      for (const [key, value] of Object.entries(reqHeaders)) {
        if (value) headers.set(key, value);
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

      // 3.4 同时也处理 Query 参数中的 key (双重保险，部分 API 可能仍用 query)
      if (targetUrl.searchParams.has('key')) {
        targetUrl.searchParams.set('key', rotatedKey);
      }

      // 4. Body 处理
      // Fastify 默认可能已经解析了 JSON Body，转发时需要 stringify 回去
      // 如果您的 Fastify 配置了 Content-Type 解析器，这里要注意
      const body =
        request.body && typeof request.body === 'object'
          ? JSON.stringify(request.body)
          : (request.body as string | undefined);

      // 5. 发起上游请求
      logger.info(
        `🔄 代理转发 -> Google | Key: ${rotatedKey.substring(0, 5)}...${rotatedKey.substring(rotatedKey.length - 5)} | Path: ${targetUrl.pathname}`,
      );

      const upstreamResponse = await fetch(targetUrl.toString(), {
        method: request.method,
        headers: headers,
        body: body,
        redirect: 'follow',
      });

      // 6. 响应透传
      // 将 Google 的状态码和 Header 传回给本地客户端
      reply.code(upstreamResponse.status);

      upstreamResponse.headers.forEach((val, key) => {
        // 过滤掉一些可能引起下游解析错误的 Header
        if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(key)) {
          reply.header(key, val);
        }
      });

      // 获取响应内容并返回
      // arrayBuffer() 比 text() 更安全，支持二进制数据（虽然 Gemini 主要是 JSON）
      const buffer = await upstreamResponse.arrayBuffer();
      return reply.send(Buffer.from(buffer));
    } catch (err) {
      logger.error('❌ Gemini Proxy Error', { err });
      return reply.code(502).send({
        error: 'Bad Gateway',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });
};
