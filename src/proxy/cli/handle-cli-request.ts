import type { GenerateContentResponse } from '@google/genai';
import { simplifyContents, simplifyResponse } from '@llm/utils.js';
import { EXCLUDED_HEADERS, FATAL_ERROR_MESSAGES, FATAL_STATUS_CODES } from '@proxy/config.js';
import type { GenerateContentRequest, GoogleApiRequest } from '@proxy/types.js';
import { GEMINI_MULTIMODAL_MODELS, GENERATE_CONTENT_METHOD } from '@shared/core/constants.js';
import { AuthError, DataError, HttpError, ParseError } from '@shared/core/errors.js';
import { logger } from '@shared/core/logger.js';
import type { Recordable } from '@shared/types/common.js';
import { delay, ms } from '@shared/utils/helpers.js';
import type { ListRotator } from '@shared/utils/list-rotator.js';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { convertToGoogleApiRequest, isValidGeminiResponse } from '../utils.js';
import type { GeminiCliClient } from './gemini-cli-client.js';

export const handleCliProxyRequest =
  (cliClient: GeminiCliClient, modelRotator: ListRotator) =>
  async (req: FastifyRequest<GenerateContentRequest>, rep: FastifyReply) => {
    const { params, body } = req;
    const { modelAndMethod } = params;
    const [originalModel, method] = modelAndMethod.split(':');
    if (method !== GENERATE_CONTENT_METHOD) {
      logger.warn(`Unsupported method: ${method}`);
      rep.code(400).type('application/json').send({ error: 'Bad Request' });
      return;
    }

    let modelRound = 0;
    while (modelRound < modelRotator.size) {
      modelRound++;
      const model = GEMINI_MULTIMODAL_MODELS.includes(originalModel!) ? originalModel! : modelRotator.next();
      const projectId = await cliClient.discoverProjectId();
      const geminiPayload = convertToGoogleApiRequest(body, model, projectId);

      logger.trace(`Gemini Cli Proxy request:`, {
        ...geminiPayload,
        request: {
          ...geminiPayload.request,
          contents: simplifyContents(geminiPayload.request.contents),
          tools:
            geminiPayload.request.tools?.map((t) => {
              if ('functionDeclarations' in t) {
                return { functionDeclarations: [t.functionDeclarations.shift() ?? {}] };
              }
              return t;
            }) ?? [],
          systemInstruction:
            typeof body.systemInstruction !== 'string'
              ? (body.systemInstruction?.parts?.[0]?.text?.slice(0, 100) ?? 'NONE')
              : body.systemInstruction.slice(0, 500),
        },
      } satisfies GoogleApiRequest);

      try {
        const { status, headers, data } = await cliClient.requestEndpoint(
          method,
          geminiPayload as unknown as Recordable,
        );
        let parsedData: { response: GenerateContentResponse };
        try {
          parsedData = JSON.parse(data) as { response: GenerateContentResponse };
          logger.trace(`Code Assist endpoint response:`, {
            ...(simplifyResponse(parsedData.response) as unknown as Recordable),
          });
        } catch (parseError) {
          throw new ParseError(
            `Failed to parse upstream JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
          );
        }

        if (!isValidGeminiResponse(parsedData.response)) {
          throw new DataError(
            'Response validation failed: Model returned empty or invalid content (no text/functionCall).',
          );
        }

        rep.code(status);
        headers.forEach((value, key) => {
          if (EXCLUDED_HEADERS.includes(key.toLowerCase())) return;
          rep.header(key, value);
        });

        if (!data.length) {
          rep.send();
          return;
        }

        rep.header('content-type', 'application/json; charset=utf-8');
        rep.type('application/json').send(parsedData.response);
        return;
      } catch (err) {
        const errStatus = err instanceof HttpError && err.status ? err.status : 502;
        const errText =
          err instanceof HttpError && err.details ? err.details : err instanceof Error ? err.message : String(err);

        if (errStatus === 401 && modelRound === 1) {
          cliClient.restAuthClient();
          continue;
        }

        const isFatalStatus = FATAL_STATUS_CODES.includes(errStatus);
        const isFatalMessage = FATAL_ERROR_MESSAGES.some((msg) => errText.toUpperCase().includes(msg));

        if (isFatalStatus || isFatalMessage || err instanceof AuthError) {
          logger.error(`[Cli Proxy] Fatal error encountered. Aborting retries.`, {
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

        if (modelRound >= modelRotator.size) {
          logger.error('[CliProxy] All models exhausted.');
          rep.code(502).type('application/json').send({
            error: 'Bad Gateway',
            message: errText,
          });
          return;
        }

        logger.warn(`[CliProxy] Transient error. Retrying...`, {
          round: `${modelRound}/${modelRotator.size}`,
          model,
          status: errStatus,
          message: errText,
        });

        await delay(ms.sec(3));

        continue;
      }
    }
  };
