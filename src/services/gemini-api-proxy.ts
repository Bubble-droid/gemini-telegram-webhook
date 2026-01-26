import { logger } from '@/services';
import { deepClone, generateStrMask, ListRotator } from '@/utils';
import { GoogleGenAI, type GenerateContentConfig } from '@google/genai';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { CONFIG } from './ConfigLoader';

type GeminiApiRequestBody = Pick<GenerateContentConfig, 'tools'>;

const ALLOWED_IPS = new Set(['127.0.0.1', '::1', 'localhost']);
const HOP_TO_HOP_HEADERS = new Set(['host', 'connection', 'content-length', 'transfer-encoding', 'content-encoding']);
const EXCLUDED_HEADERS = new Set(['content-encoding', 'content-length', 'transfer-encoding']);

const keyRotator = new ListRotator(CONFIG.GEMINI_API_KEYS);

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

const refreshFileSearchStoreNames = async <T extends GeminiApiRequestBody>(currentKey: string, body: T): Promise<T> => {
  const copyBody = deepClone(body);
  if (!copyBody.tools?.some((t) => 'fileSearch' in t)) return copyBody;

  const client = new GoogleGenAI({ apiKey: currentKey });
  const stores = await client.fileSearchStores.list({ config: { pageSize: 20 } });

  copyBody.tools = copyBody.tools.map((tool) => {
    if ('fileSearch' in tool) {
      const displayNames = tool.fileSearch.fileSearchStoreNames;
      return {
        fileSearch: {
          ...tool.fileSearch,
          fileSearchStoreNames: stores.page.flatMap((s) => {
            return displayNames?.includes(s.displayName!) && s.name ? [s.name] : [];
          }),
        },
      };
    }
    return tool;
  });

  return copyBody;
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
    const targetUrl = new URL(pathWithoutPrefix, CONFIG.GEMINI_API_BASE_URL);

    const rotatedKey = keyRotator.next();
    const headers = normalizeHeaders(req.headers, rotatedKey);

    const body = req.body;
    const refreshedBody = body ? await refreshFileSearchStoreNames(rotatedKey, body) : null;

    logger.info(`[Proxy] Forwarding to Google`, {
      path: targetUrl.pathname,
      keyMask: generateStrMask(rotatedKey, 5),
    });
    logger.trace(`Body Forwarding:`, { body });

    const upstreamResponse = await fetch(targetUrl.toString(), {
      method: req.method,
      headers,
      ...(refreshedBody && {
        duplex: 'half',
        body: JSON.stringify(refreshedBody),
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
