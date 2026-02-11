import {
  HarmBlockThreshold,
  HarmCategory,
  ThinkingLevel,
  type GenerateContentConfig,
  type SafetySetting,
  type ThinkingConfig,
} from '@google/genai';
import type { ReactionTypeEmoji } from 'grammy/types';
import path from 'node:path';

export const DATA_DIR = process.env['NODE_ENV'] === 'development' ? path.join(process.cwd(), 'data') : '/data';

export const CHAT_HISTORY_FILE = 'chat-history.json';
export const FAQ_DATA_FILE = 'faq-data.json';
export const LONG_TERM_MEMORY_FILE = 'memories.json';

export const FILE_ID_FILE = 'file-id-map.json';
export const SCHEDULED_TASK_FILE = 'tasks.json';

export const MCP_SERVERS_FILE = 'mcp-servers.json';

export const GITHUB_BASE_URL = 'https://github.com';
export const GITHUB_RAW_URL = 'https://raw.githubusercontent.com';

export const TELEGRAM_BASE_URL = 'https://api.telegram.org';
export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com';

export const GENERATE_CONTENT_METHOD = 'generateContent';

export const DEFAULT_SERVER_LISTEN_PORT = 39001;

const LOCAL_PROXY_ADDRESS = `http://127.0.0.1:${DEFAULT_SERVER_LISTEN_PORT}`;

export const GEMINI_PROXY_BASE_URL = `${LOCAL_PROXY_ADDRESS}/gemini`;

export const CLI_PROXY_BASE_URL = `${LOCAL_PROXY_ADDRESS}/cli`;

export const SERVER_BODY_LIMIT = 100 * 1024 * 1024;

export const GEMINI_MODELS = [
  // 'gemini-3-pro-preview',
  // 'gemini-3-flash-preview',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
];
export const GEMMA_MODELS = ['gemma-3-12b-it', 'gemma-3-27b-it'];

export const CODE_ASSIST_ENDPOINT = 'https://cloudcode-pa.googleapis.com';

export const CODE_ASSIST_API_VERSION = 'v1internal';

export const CLI_VERSION = '0.26.0';

export const OAUTH_CLIENT_ID = '681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com';

export const OAUTH_CLIENT_SECRET = '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';

export const GEMINI_API_SAFETY_SETTINGS: SafetySetting[] = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

export const GEMINI_SAFETY_SETTINGS: SafetySetting[] = [
  ...GEMINI_API_SAFETY_SETTINGS,
  { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_IMAGE_HATE, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_IMAGE_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_IMAGE_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_IMAGE_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_JAILBREAK, threshold: HarmBlockThreshold.BLOCK_NONE },
];

export const DEFAULT_TEMPERATURE = 0;

export const THINKING_CONFIG_LEVER: ThinkingConfig = { includeThoughts: false, thinkingLevel: ThinkingLevel.HIGH };
export const THINKING_CONFIG_BUDGET: ThinkingConfig = { includeThoughts: false, thinkingBudget: 24576 };

export const GEMINI_CLIENT_BASE_CONFIG: GenerateContentConfig = {
  temperature: DEFAULT_TEMPERATURE,
  safetySettings: GEMINI_SAFETY_SETTINGS,
  thinkingConfig: THINKING_CONFIG_BUDGET,
};

export const DEFAULT_SYSTEM_PROMPT = 'You are a helpful assistant.';

export const SEC = 1000;
export const MIN = 60 * SEC;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

export const DEFAULT_RATE_LIMIT = 20 * SEC;

export const SUPPORTED_MIME_TYPES = {
  AppTypes: ['pdf'],
  ImageTypes: ['png', 'jpeg', 'webp', 'heic', 'heif'],
  VideoTypes: ['mp4', 'mpeg', 'mov', 'avi', 'x-flv', 'mpg', 'webm', 'wmv', '3gpp'],
  AudioTypes: ['wav', 'mp3', 'aiff', 'aac', 'ogg', 'flac'],
};

export const FILE_EXT_MIMES = {
  // 文本与代码
  txt: 'text/plain',

  py: 'text/plain',
  java: 'text/plain',
  c: 'text/plain',
  cpp: 'text/plain',
  cs: 'text/plain',
  go: 'text/plain',
  php: 'text/plain',
  sql: 'text/plain',

  html: 'text/html',
  htm: 'text/html',
  vue: 'text/html',

  css: 'text/css',
  csv: 'text/csv',

  md: 'text/markdown',
  mdx: 'text/markdown',

  js: 'text/javascript',
  jsx: 'text/javascript',

  xml: 'text/xml',

  yaml: 'text/yaml',
  yml: 'text/yaml',

  // 图片
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  gif: 'image/gif', // 特殊处理：将作为 video/mp4 发送

  // 视频
  mp4: 'video/mp4',
  mpeg: 'video/mpeg',
  mov: 'video/mov',
  avi: 'video/avi',
  flv: 'video/x-flv',
  'x-flv': 'video/x-flv',
  mpg: 'video/mpg',
  webm: 'video/webm',
  wmv: 'video/wmv',
  '3gpp': 'video/3gpp',

  // 音频
  wav: 'audio/wav',
  mp3: 'audio/mp3',
  aiff: 'audio/aiff',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
} as const;

export const ALLOWED_REACTIONS = [
  '❤',
  '👍',
  '👎',
  '🔥',
  '🥰',
  '👏',
  '😁',
  '🤔',
  '🤯',
  '😱',
  '🤬',
  '😢',
  '🎉',
  '🤩',
  '🤮',
  '💩',
  '🙏',
  '👌',
  '🕊',
  '🤡',
  '🥱',
  '🥴',
  '😍',
  '🐳',
  '❤‍🔥',
  '🌚',
  '🌭',
  '💯',
  '🤣',
  '⚡',
  '🍌',
  '🏆',
  '💔',
  '🤨',
  '😐',
  '🍓',
  '🍾',
  '💋',
  '🖕',
  '😈',
  '😴',
  '😭',
  '🤓',
  '👻',
  '👨‍💻',
  '👀',
  '🎃',
  '🙈',
  '😇',
  '😨',
  '🤝',
  '✍',
  '🤗',
  '🫡',
  '🎅',
  '🎄',
  '☃',
  '💅',
  '🤪',
  '🗿',
  '🆒',
  '💘',
  '🙉',
  '🦄',
  '😘',
  '💊',
  '🙊',
  '😎',
  '👾',
  '🤷‍♂',
  '🤷',
  '🤷‍♀',
  '😡',
] as const satisfies ReactionTypeEmoji['emoji'][];
