import { join } from 'node:path';
import { env } from 'node:process';

export const DATA_DIR = env['NODE_ENV'] === 'development' ? join(process.cwd(), 'data') : '/data';

export const GITHUB_BASE_URL = 'https://github.com';
export const GITHUB_RAW_URL = 'https://raw.githubusercontent.com';

export const TELEGRAM_API_BASE_URL = 'https://api.telegram.org';

export const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com';

export const FILE_SEARCH_MODEL = 'gemini-3-flash-preview';
export const GENERATE_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-3-flash-preview'];
export const CHITCHAT_MODELS = ['gemma-3-4b-it', 'gemma-3-12b-it', 'gemma-3-27b-it'];
