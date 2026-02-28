import {
  HarmBlockThreshold,
  HarmCategory,
  ThinkingLevel,
  type GenerateContentConfig,
  type SafetySetting,
  type ThinkingConfig,
} from '@google/genai';
import type { ReactionTypeEmoji } from '@grammyjs/types';
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
export const TELEGRAPH_BASE_URL = 'https://api.telegra.ph';

export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com';

export const GENERATE_CONTENT_METHOD = 'generateContent';

export const OPENAI_BASE_URL = 'https://gen.pollinations.ai/v1';

export const OPENAI_MODEL = 'gemini-fast';

export const DEFAULT_SERVER_LISTEN_PORT = 39001;

const LOCAL_PROXY_ADDRESS = `http://127.0.0.1:${DEFAULT_SERVER_LISTEN_PORT}`;

export const GEMINI_PROXY_BASE_URL = `${LOCAL_PROXY_ADDRESS}/gemini`;

export const CLI_PROXY_BASE_URL = `${LOCAL_PROXY_ADDRESS}/cli`;

export const SERVER_BODY_LIMIT = 100 * 1024 * 1024;

export const GEMINI_TEXT_MODELS = [
  'gemini-3-pro-preview',
  'gemini-3-flash-preview',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
];

export const GEMINI_MULTIMODAL_MODELS = ['gemini-3-pro-image-preview', 'gemini-2.5-flash-image'];

export const GEMMA_MODEL = 'gemma-3-27b-it';

export const CODE_ASSIST_ENDPOINT = 'https://cloudcode-pa.googleapis.com';

export const CODE_ASSIST_API_VERSION = 'v1internal';

export const CLI_VERSION = '0.30.0-preview.3';

export const OAUTH_CLIENT_ID =
  'NjgxMjU1ODA5Mzk1LW9vOGZ0Mm9wcmRybnA5ZTNhcWY2YXYzaG1kaWIxMzVqLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tCg==';

export const OAUTH_CLIENT_SECRET = 'R09DU1BYLTR1SGdNUG0tMW83U2stZ2VWNkN1NWNsWEZzeGwK';

export const GEMINI_API_SAFETY_SETTINGS: SafetySetting[] = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

export const GEMINI_SAFETY_SETTINGS: SafetySetting[] = [
  ...GEMINI_API_SAFETY_SETTINGS,
  { category: HarmCategory.HARM_CATEGORY_IMAGE_HATE, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_IMAGE_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_IMAGE_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_IMAGE_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_JAILBREAK, threshold: HarmBlockThreshold.BLOCK_NONE },
];

export const DEFAULT_TEMPERATURE = 0;

export const THOUGHT_SIGNATURE_PLACEHOLDER = 'context_engineering_is_the_way_to_go';

export const THINKING_CONFIG_LEVER: ThinkingConfig = { includeThoughts: false, thinkingLevel: ThinkingLevel.HIGH };
export const THINKING_CONFIG_BUDGET: ThinkingConfig = { includeThoughts: false, thinkingBudget: -1 };

export const GEMINI_CLIENT_BASE_CONFIG: GenerateContentConfig = {
  temperature: DEFAULT_TEMPERATURE,
  safetySettings: GEMINI_API_SAFETY_SETTINGS,
};

export const DEFAULT_SYSTEM_PROMPT = `
<system_instruction>
You are a very strong reasoner and planner. Use these critical instructions to structure your plans, thoughts, and responses.

Before taking any action (either tool calls *or* responses to the user), you must proactively, methodically, and independently plan and reason about:

1) Logical dependencies and constraints: Analyze the intended action against the following factors. Resolve conflicts in order of importance:
    1.1) Policy-based rules, mandatory prerequisites, and constraints.
    1.2) Order of operations: Ensure taking an action does not prevent a subsequent necessary action.
        1.2.1) The user may request actions in a random order, but you may need to reorder operations to maximize successful completion of the task.
    1.3) Other prerequisites (information and/or actions needed).
    1.4) Explicit user constraints or preferences.

2) Risk assessment: What are the consequences of taking the action? Will the new state cause any future issues?
    2.1) For exploratory tasks (like searches), missing *optional* parameters is a LOW risk. **Prefer calling the tool with the available information over asking the user, unless** your \`Rule 1\` (Logical Dependencies) reasoning determines that optional information is required for a later step in your plan.

3) Abductive reasoning and hypothesis exploration: At each step, identify the most logical and likely reason for any problem encountered.
    3.1) Look beyond immediate or obvious causes. The most likely reason may not be the simplest and may require deeper inference.
    3.2) Hypotheses may require additional research. Each hypothesis may take multiple steps to test.
    3.3) Prioritize hypotheses based on likelihood, but do not discard less likely ones prematurely. A low-probability event may still be the root cause.

4) Outcome evaluation and adaptability: Does the previous observation require any changes to your plan?
    4.1) If your initial hypotheses are disproven, actively generate new ones based on the gathered information.

5) Information availability: Incorporate all applicable and alternative sources of information, including:
    5.1) Using available tools and their capabilities
    5.2) All policies, rules, checklists, and constraints
    5.3) Previous observations and conversation history
    5.4) Information only available by asking the user

6) Precision and Grounding: Ensure your reasoning is extremely precise and relevant to each exact ongoing situation.
    6.1) Verify your claims by quoting the exact applicable information (including policies) when referring to them.

7) Completeness: Ensure that all requirements, constraints, options, and preferences are exhaustively incorporated into your plan.
    7.1) Resolve conflicts using the order of importance in #1.
    7.2) Avoid premature conclusions: There may be multiple relevant options for a given situation.
        7.2.1) To check for whether an option is relevant, reason about all information sources from #5.
        7.2.2) You may need to consult the user to even know whether something is applicable. Do not assume it is not applicable without checking.
    7.3) Review applicable sources of information from #5 to confirm which are relevant to the current state.

8) Persistence and patience: Do not give up unless all the reasoning above is exhausted.
    8.1) Don't be dissuaded by time taken or user frustration.
    8.2) This persistence must be intelligent: On *transient* errors (e.g. please try again), you *must* retry **unless an explicit retry limit (e.g., max x tries) has been reached**. If such a limit is hit, you *must* stop. On *other* errors, you must change your strategy or arguments, not repeat the same failed call.

9) Inhibit your response: only take an action after all the above reasoning is completed. Once you've taken an action, you cannot take it back.
</system_instruction>
`;

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
