import type { GeneralFunctionSchema } from '@llm/types/agent';
import type { ReactionTypeEmoji } from 'grammy/types';

type FileStoreType = keyof typeof FileStores;

type FileStoreDisplayName = {
  [K in FileStoreType]: `${K}/${(typeof FileStores)[K][number]}`;
}[FileStoreType];

const FileStores = {
  documents: ['gui-for-cores', 'sing-box', 'mihomo', 'hysteria2', 'anytls'],
  sourcecode: ['plugin-hub'],
} as const;

const getFileStoreNames = (): FileStoreDisplayName[] => {
  return Object.entries(FileStores).flatMap(([category, items]) =>
    items.map((item) => `${category}/${item}` as FileStoreDisplayName),
  );
};

export const RESEARCH_TOOLS = [
  {
    name: 'file_search',
    description:
      'This tool can call file search tool provided by Google Gemini to search specified file storage areas, allowing for the joint search of multiple file storage areas. (e.g., simultaneously search the documentation for GUI.for.Singbox and sing-box to understand the specific meaning of a certain configuration option)',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description:
            'Describe the action you want to perform in natural language. (e.g., Please help me query the configuration structure of the tls field in sing-box)',
        },
        fileStores: {
          type: 'array',
          description: 'List of file storage areas to be searched.',
          items: {
            type: 'string',
            description: 'Name of the file storage area.',
            format: 'enum',
            enum: getFileStoreNames(),
          },
          minItems: 1,
        },
      },
      required: ['prompt', 'fileStores'],
    },
  },
  {
    name: 'call_github_tool',
    description:
      'This tool can call the set of tools provided by GitHub to perform operations on the GitHub platform, supporting almost all GitHub REST API operations. (e.g., querying commit records for xxx repository, obtaining release details, etc.)',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description:
            'Describe the action you want to perform in natural language. (e.g., Please help me find the source code about plugin functions in the GUI.for.SingBox repository.)',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'web_research',
    description:
      'Facilitates real-time information retrieval using Google Search and extracts specific web page content via URL Context. Use this for current events, fact-checking, or deep-diving into specific links.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description:
            'The research query or context request described in natural language (e.g., "Find the latest documentation for the Rust language").',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'code_interpreter',
    description:
      'Provides a Python execution environment for performing complex mathematical calculations, data analysis, and algorithmic logic that exceeds standard text generation capabilities.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description:
            'The logic, calculation, or data task described in natural language (e.g., "Calculate the 100th Fibonacci number" or "Parse this JSON structure").',
        },
      },
      required: ['prompt'],
    },
  },
] as const satisfies GeneralFunctionSchema[];

export const INTERACTIVE_TOOLS = [
  {
    name: 'reply_to_file',
    description:
      'Generates a downloadable file artifact and sends it directly to the user within the current chat session. Use this tool strictly when the user requests a distinct file output (e.g., "save this as a CSV", "create a log file") rather than inline text.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        chatId: {
          type: 'number',
          description: 'The unique identifier for the current active chat session.',
        },
        messageId: {
          type: 'number',
          description: 'The ID of the specific user message that triggered this file generation.',
        },
        content: {
          type: 'string',
          description:
            'The raw, unescaped text content of the file. Ensure strict adherence to the requested format (e.g., valid JSON, valid Python code) without markdown code blocks.',
        },
        name: {
          type: 'string',
          description:
            'The complete filename, including the correct extension (e.g., "data_analysis.csv", "server_config.json").',
        },
        type: {
          type: 'string',
          description:
            'The standard IANA Media Type (MIME type) corresponding to the file content (e.g., "text/csv", "application/json", "text/plain").',
        },
      },
      required: ['chatId', 'messageId', 'content', 'name', 'type'],
    },
  },
  {
    name: 'set_message_reaction',
    description: `This tool can respond to a specific message within a conversation. (e.g. a funny message can be set with a laughing-crying emoji.)`,
    parametersJsonSchema: {
      type: 'object',
      properties: {
        chatId: {
          type: 'number',
          description: 'Chat ID of the conversation.',
        },
        messageId: {
          type: 'number',
          description: 'Message ID of the target message.',
        },
        reaction: {
          type: 'string',
          description: 'Reaction to set on the message. (e.g. 😂 or 😭)',
          format: 'enum',
          enum: [
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
          ] satisfies ReactionTypeEmoji['emoji'][],
        },
      },
      required: ['chatId', 'messageId', 'reaction'],
    },
  },
] as const satisfies GeneralFunctionSchema[];

export const STORE_TOOLS = [
  {
    name: 'memory_manage',
    description: `Use this tool to manage persistent memory for the current conversation user, supporting add, get, and delete operations. In the conversation with the current user, if the user shares some important key information, it may be more relevant to add this information, or the user may proactively request to add memories. (e.g. add a memory "Users like to use the sing-box kernel.")`,
    parametersJsonSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description:
            'Action to perform. (e.g. add(Add memories belonging to the specified user), get(Retrieve memories added for the specified user), remove(Delete specific memories of a specified user); All actions take effect in the next conversation)',
          format: 'enum',
          enum: ['add', 'get', 'remove'],
        },
        userId: {
          type: 'number',
          description: 'User ID to perform the action on.',
        },
        memory: {
          type: 'string',
          description:
            'Summarize the memory to be added in one sentence. (e.g. User like to use GUI.for.SingBox to manage configurations)',
        },
        index: {
          type: 'number',
          description: 'Index of the memory to be deleted.',
          minimum: 0,
        },
      },
      required: ['action', 'userId'],
    },
  },
] as const satisfies GeneralFunctionSchema[];

export const FUNCTION_TOOLS = [...RESEARCH_TOOLS, ...INTERACTIVE_TOOLS, ...STORE_TOOLS];
