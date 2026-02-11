import type { GenerateContentResponse } from '@google/genai';
import { GoogleGenAI, type FileSearchStore } from '@google/genai';
import { simplifyContents } from '@llm/utils.js';
import { EXCLUDED_HEADERS, FATAL_ERROR_MESSAGES, FATAL_STATUS_CODES } from '@proxy/config.js';
import type { GeminiApiRequest, generateContentRequest } from '@proxy/types.js';
import { getGeminiGenerateContentEndpoint, isValidGeminiResponse } from '@proxy/utils.js';
import { keyRotator, modelRotator } from '@services/rotators.js';
import { GEMINI_MODELS, GENERATE_CONTENT_METHOD } from '@shared/core/constants.js';
import { DataError, HttpError, ParseError } from '@shared/core/errors.js';
import { logger } from '@shared/core/logger.js';
import type { Recordable } from '@shared/types/common.js';
import type { HttpMethod } from '@shared/types/http.js';
import { deepClone, delay, generateStrMask, ms, shuffleArray } from '@shared/utils/helpers.js';
import { httpRequest } from '@shared/utils/http.js';
import type { FastifyReply, FastifyRequest } from 'fastify';

const fileSearchStoreBuffer = new Map<string, FileSearchStore[]>();

const refreshFileSearchStoreNames = async <T extends GeminiApiRequest>(currentKey: string, body: T): Promise<T> => {
  const copyBody = deepClone(body);
  if (!copyBody.tools?.some((t) => 'fileSearch' in t)) return copyBody;

  let stores: FileSearchStore[];
  if (fileSearchStoreBuffer.has(currentKey)) {
    stores = fileSearchStoreBuffer.get(currentKey)!;
  } else {
    const client = new GoogleGenAI({ apiKey: currentKey });
    const result = await client.fileSearchStores.list({ config: { pageSize: 20 } });
    stores = result.page;
    fileSearchStoreBuffer.set(currentKey, stores);
  }

  copyBody.tools = copyBody.tools.map((tool) => {
    if ('fileSearch' in tool) {
      const displayNames = tool.fileSearch.fileSearchStoreNames;
      return {
        fileSearch: {
          ...tool.fileSearch,
          fileSearchStoreNames: stores.flatMap((s) => {
            return displayNames?.includes(s.displayName!) && s.name ? [s.name] : [];
          }),
        },
      };
    }
    return tool;
  });

  return copyBody;
};

export const handleGeminiProxyRequest = async (req: FastifyRequest, rep: FastifyReply) => {
  const { params, body } = req as generateContentRequest;
  const { modelAndMethod } = params;
  const [, method] = modelAndMethod.split(':');
  if (method !== GENERATE_CONTENT_METHOD) {
    logger.warn(`Unsupported method: ${method}`);
    rep.code(400).type('application/json').send({ error: 'Bad Request' });
    return;
  }

  const reqHeaders = new Headers();
  reqHeaders.set('content-type', 'application/json');

  const shuffledModels = shuffleArray(GEMINI_MODELS);

  let keyRound = 0;
  while (keyRound < keyRotator.size) {
    keyRound++;
    const key = keyRotator.next();
    reqHeaders.set('x-goog-api-key', key);

    let modelRound = 0;
    for (const model of shuffledModels) {
      modelRound++;
      const endpoint = getGeminiGenerateContentEndpoint(model);

      try {
        const refreshedBody = await refreshFileSearchStoreNames(key, body);

        logger.info(`Forwarding to Google`, {
          target: endpoint,
          keyMask: generateStrMask(key, 5),
          model,
        });
        logger.trace(`Body Forwarding:`, {
          ...body,
          contents: simplifyContents(body.contents),
          systemInstruction: '[MASKED]',
        });

        const { status, headers, data } = await httpRequest(endpoint, {
          method: req.method as HttpMethod,
          headers: reqHeaders,
          body: JSON.stringify(refreshedBody),
          responseType: 'text',
          timeout: ms.min(5),
        });

        let parsedData: GenerateContentResponse;
        try {
          parsedData = JSON.parse(data) as GenerateContentResponse;
          logger.trace(`Gemini response:`, parsedData as unknown as Recordable);
        } catch (parseError) {
          throw new ParseError(
            `Failed to parse upstream JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
          );
        }

        if (!isValidGeminiResponse(parsedData)) {
          throw new DataError(
            'Response validation failed: Model returned empty or invalid content (no text/functionCall).',
          );
        }

        rep.code(status);
        headers.forEach((value, key) => {
          if (EXCLUDED_HEADERS.includes(key.toLowerCase())) return;
          rep.header(key, value);
        });

        if (!data.trim().length) {
          rep.send();
          return;
        }

        rep.header('content-type', 'application/json; charset=utf-8');
        rep.send(data);
        return;
      } catch (err) {
        const errStatus = err instanceof HttpError && err.status ? err.status : 502;
        const errText =
          err instanceof HttpError && err.details ? err.details : err instanceof Error ? err.message : String(err);

        const isFatalStatus = FATAL_STATUS_CODES.includes(errStatus);
        const isFatalMessage = FATAL_ERROR_MESSAGES.some((msg) => errText.toUpperCase().includes(msg));

        if (isFatalStatus || isFatalMessage) {
          logger.error(`[Gemini Proxy] Fatal error encountered. Aborting retries.`, {
            keyMask: generateStrMask(key, 5),
            model,
            status: errStatus,
            message: errText,
          });

          rep.code(errStatus).type('application/json').send({
            error: 'Bad Gateway',
            message: errText,
          });
          return;
        }

        const isLastKey = keyRound >= keyRotator.size;
        const isLastModel = modelRound >= shuffledModels.length;

        if (isLastKey && isLastModel) {
          logger.error('[Proxy] All keys and models exhausted.');
          rep.code(errStatus).type('application/json').send({
            error: 'Bad Gateway',
            message: errText,
          });
          return;
        }

        logger.warn(`[Gemini Proxy] Transient error. Retrying...`, {
          keyRound: `${keyRound}/${keyRotator.size}`,
          modelRound: `${modelRound}/${modelRotator.size}`,
          keyMask: generateStrMask(key, 5),
          model,
          status: errStatus,
          message: errText,
        });

        await delay(ms.sec(3));

        continue;
      }
    }
  }
  rep.code(500).type('application/json').send({ error: 'Internal Server Error: No Upstream Available' });
};
