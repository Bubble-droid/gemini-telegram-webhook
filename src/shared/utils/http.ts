import { HttpError, NetworkError, ParseError } from '@shared/core/errors.js';
import { logger } from '@shared/core/logger.js';
import type { RequestOpts, RequestResult, ResponseBody, ResponseType } from '@shared/types/http.js';
import { generateStrMask } from './helpers.js';

export const httpRequest = async <T extends ResponseType>(
  url: string,
  opts: RequestOpts<T>,
): Promise<RequestResult<T>> => {
  logger.trace(`Requesting ${generateStrMask(url, 10)}`);
  const { method = 'GET', responseType, timeout, ...fetchOpts } = opts;

  let controller: AbortController | undefined;
  let timer: NodeJS.Timeout | undefined;
  if (timeout && timeout > 0) {
    controller = new AbortController();
    timer = setTimeout(() => {
      controller!.abort();
    }, timeout);
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...fetchOpts,
      method,
      ...(controller && { signal: controller.signal }),
    });
  } catch (err) {
    const errText = err instanceof Error ? err.message : String(err);
    logger.error(`Request failed: ${errText}`, { url: generateStrMask(url, 10), err });
    if (err instanceof Error && err.name === 'AbortError') {
      throw new NetworkError(`Request timed out after ${timeout}ms`, err);
    }
    throw new NetworkError(`Failed to network request. ${errText}`, err instanceof Error ? err : undefined);
  } finally {
    if (timer) clearTimeout(timer);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Failed to read error response body.');
    throw new HttpError(
      `Error response from server which status ${res.status} - ${res.statusText}: ${errText}`,
      res.status,
      errText,
    );
  }

  const baseResult = { status: res.status, headers: res.headers };
  try {
    const data = (await res[responseType]()) as ResponseBody<T>;
    return { ...baseResult, data };
  } catch (err) {
    throw new ParseError(`Failed to parse response body. ${err instanceof Error ? err.message : String(err)}`);
  }
};
