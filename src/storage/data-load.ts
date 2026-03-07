import { generateRawUrl, readTextFile } from '@shared/utils/helpers.js';
import { httpRequest } from '@shared/utils/http.js';

export const loadData = async <T>(path: string, type: 'json' | 'text'): Promise<T> => {
  let data = '';
  if (process.env['NODE_ENV'] === 'development') {
    data = await readTextFile(path);
  } else {
    const url = generateRawUrl(path);
    const res = await httpRequest(url, {
      method: 'GET',
      redirect: 'follow',
      responseType: 'text',
    });
    data = res.data;
  }
  if (type === 'json') return JSON.parse(data) as T;
  return data as T;
};
