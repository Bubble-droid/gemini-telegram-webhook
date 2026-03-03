import { DATA_DIR } from '@shared/core/constants.js';
import { generateRawUrl, readTextFile } from '@shared/utils/helpers.js';
import { httpRequest } from '@shared/utils/http.js';
import { LowSync } from 'lowdb';
import { JSONFileSync } from 'lowdb/node';
import { existsSync, mkdirSync } from 'node:fs';

export const loadLowdb = <T>(path: string, data: T): LowSync<T> => {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  const adapter = new JSONFileSync<T>(path);
  const db = new LowSync(adapter, data);
  try {
    db.read();
  } catch {
    //
  }
  db.data ??= { ...data };
  db.write();
  return db;
};

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
