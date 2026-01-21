import { config, logger } from '@/services';
import { KeyRotator } from '@/utils';
import type { FastifyReply, FastifyRequest } from 'fastify';

const ALLOWED_IPS = new Set(['127.0.0.1', '::1', 'localhost']);
const HOP_TO_HOP_HEADERS = new Set(['host', 'connection', 'content-length', 'transfer-encoding', 'content-encoding']);
const EXCLUDED_HEADERS = new Set(['content-encoding', 'content-length', 'transfer-encoding']);

const keyRotator = new KeyRotator();

const isLocalRequest = (ip: string): boolean => {
  return ALLOWED_IPS.has(ip);
};

const normalizeHeaders = (incomingHeaders: FastifyRequest['headers'], rotatedKey: string): Headers => {
  const headers = new Headers();
  for (const [key, value] of Object.entries(incomingHeaders)) {
    if (value === undefined) continue;
    // 1. 过滤 Hop-to-hop headers 以及可能导致协议错误的 headers
    if (HOP_TO_HOP_HEADERS.has(key.toLowerCase())) continue;
    // 处理 string[] 情况
    const headerValue = Array.isArray(value) ? value.join(',') : value;
    headers.set(key, headerValue);
  }
  // 强制覆盖 API Key
  headers.set('x-goog-api-key', rotatedKey);
  headers.set('content-type', 'application/json');
  return headers;
};

export const handleProxyRequest = async (req: FastifyRequest, rep: FastifyReply): Promise<void> => {
  try {
    if (!isLocalRequest(req.ip)) {
      logger.warn(`[Proxy] Blocked non-local request from ${req.ip}`);
      rep.code(403).type('application/json').send({ error: 'Forbidden' });
      return;
    }

    const originalPath = req.raw.url ?? '';
    const pathWithoutPrefix = originalPath.replace(/^\/gemini/, '');
    const targetUrl = new URL(pathWithoutPrefix, config.geminiApiBaseUrl);

    const rotatedKey = keyRotator.nextKey();
    const headers = normalizeHeaders(req.headers, rotatedKey);

    logger.info(`[Proxy] Forwarding to Google`, {
      path: targetUrl.pathname,
      keyMask: `${rotatedKey.slice(0, 5)}***${rotatedKey.slice(-5)}`,
    });
    logger.trace(`Body Forwarding:`, { body: req.body });

    const upstreamResponse = await fetch(targetUrl.toString(), {
      method: req.method,
      headers,
      ...(req.body != null && {
        duplex: 'half',
        body: JSON.stringify(req.body),
      }),
    });

    const responseText = await upstreamResponse.text();

    try {
      const parsedBody = JSON.parse(responseText) as unknown;
      logger.trace(`Body Received:`, { body: parsedBody });
    } catch {
      logger.trace('Body Received (Raw String)', { body: responseText });
    }

    // 响应状态码透传
    rep.code(upstreamResponse.status);

    // Header 透传
    upstreamResponse.headers.forEach((value, key) => {
      if (EXCLUDED_HEADERS.has(key.toLowerCase())) return;
      rep.header(key, value);
    });

    if (!responseText.length) {
      rep.send();
      return;
    }

    rep.header('content-type', 'application/json; charset=utf-8');
    rep.send(responseText);
  } catch (err) {
    logger.error('❌ Gemini Proxy Error', { err });
    rep
      .code(502)
      .type('application/json')
      .send({
        error: 'Bad Gateway',
        message: err instanceof Error ? err.message : String(err),
      });
  }
};
