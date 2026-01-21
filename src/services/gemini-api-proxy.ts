import { config, logger } from '@/services';
import { KeyRotator } from '@/utils';
import type { FastifyReply, FastifyRequest } from 'fastify';

const ALLOWED_IPS = new Set(['127.0.0.1', '::1', 'localhost']);

const isLocalRequest = (ip: string): boolean => {
  return ALLOWED_IPS.has(ip);
};

const normalizeHeaders = (incomingHeaders: FastifyRequest['headers'], rotatedKey: string): Headers => {
  const headers = new Headers();

  for (const [key, value] of Object.entries(incomingHeaders)) {
    if (!value) continue;

    // 过滤掉不需要透传的 hop-to-hop headers
    const lowerKey = key.toLowerCase();
    if (['host', 'connection', 'content-length', 'transfer-encoding'].includes(lowerKey)) {
      continue;
    }

    // 处理 string[] 情况
    const headerValue = Array.isArray(value) ? value.join(',') : value;
    headers.set(key, headerValue);
  }

  // 强制覆盖 API Key
  headers.set('x-goog-api-key', rotatedKey);

  return headers;
};

const keyRotator = new KeyRotator();

export const handleProxyRequest = async (req: FastifyRequest, rep: FastifyReply): Promise<void> => {
  try {
    if (!isLocalRequest(req.ip)) {
      logger.warn(`[Proxy] Blocked non-local request from ${req.ip}`);
      rep.code(403).type('application/json').send({ error: 'Forbidden' });
      return;
    }

    // 1. URL 重组 (处理 Query Params)
    // 使用 URL 构造函数处理路径合并，避免正则替换的边缘情况
    const originalPath = req.raw.url ?? ''; // raw.url 包含 path + query
    const pathWithoutPrefix = originalPath.replace(/^\/gemini/, '');
    const targetUrl = new URL(pathWithoutPrefix, config.geminiApiBaseUrl);

    // 2. Key 轮换
    const rotatedKey = keyRotator.nextKey();

    // 3. Header 处理
    const headers = normalizeHeaders(req.headers, rotatedKey);

    // 4. 日志记录
    logger.info(`[Proxy] Forwarding to Google`, {
      path: targetUrl.pathname,
      keyMask: `${rotatedKey.slice(0, 5)}***${rotatedKey.slice(-5)}`,
    });
    logger.debug(`Body Forwarding:`, { body: req.body });

    // 5. 发起上游请求
    const upstreamResponse = await fetch(targetUrl.toString(), {
      method: req.method,
      headers,
      ...(req.body !== undefined && { body: JSON.stringify(req.body) }),
    });

    // 6. 响应透传处理
    rep.code(upstreamResponse.status);

    // 6.1 复制响应头
    upstreamResponse.headers.forEach((value, key) => {
      // 过滤 gzip 等压缩头，因为 fetch 会自动解压，如果透传 gzip 头但内容已解压，客户端会报错
      if (['content-encoding', 'content-length', 'transfer-encoding'].includes(key)) {
        return;
      }
      void rep.header(key, value);
    });

    if (upstreamResponse.body) {
      // 将 Web ReadableStream 转换为 Node Stream 并透传给 Fastify
      rep.send(upstreamResponse.body);
      return;
    }

    rep.send();
  } catch (err) {
    logger.error('❌ Gemini Proxy Error', { err });
    void rep.code(502).send({
      error: 'Bad Gateway',
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
