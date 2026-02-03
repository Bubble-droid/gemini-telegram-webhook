import { HttpError, NetworkError, ParseError } from '@shared/core/errors';
import { logger } from '@shared/core/logger';
import type { RequestOpts, RequestResult, ResponseBody, ResponseType } from '@shared/types/http';
import { ms } from './helpers';

export const httpRequest = async <T extends ResponseType>(
  url: string,
  opts: RequestOpts<T>,
): Promise<RequestResult<T>> => {
  logger.trace(`Requesting ${url}`);
  const { method = 'GET', responseType, timeout = ms.sec(15), ...fetchOpts } = opts;
  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, timeout);
  try {
    const res = await fetch(url, {
      ...fetchOpts,
      method,
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Failed to read error response body.');
      throw new HttpError(
        `Error response from server which status ${res.status} - ${res.statusText}\n${errText}`,
        res.status,
        errText,
      );
    }
    const baseResult = { status: res.status, headers: res.headers };

    try {
      const data = (await res[responseType]()) as ResponseBody<T>;
      return { ...baseResult, data };
    } catch (error) {
      throw new ParseError(
        `Failed to parse response body. ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  } catch (err) {
    const errText = err instanceof Error ? err.message : 'Unknown error';
    logger.error(`Request failed: ${errText}`, { url, err });
    if (err instanceof Error && err.name === 'AbortError') {
      throw new NetworkError(`Request timed out after ${timeout}ms`, err);
    }
    throw new NetworkError(`Failed to network request. ${errText}`, err instanceof Error ? err : undefined);
  } finally {
    clearTimeout(timer);
  }
};
