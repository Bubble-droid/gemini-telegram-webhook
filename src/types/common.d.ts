// src/types/common.d.ts

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface RequestSchema {
  type: 'object';
  properties: {
    [key: string]: {
      type: 'string' | 'number' | 'boolean' | 'object' | 'array';
      [key: string]: unknown;
    };
  };
  required?: string[];
  additionalProperties?: boolean;
}

export interface SchedulerApiResponseBody {
  status: 'scheduled';
  runAt: number;
}

/**
 * 用于匹配自定义 Markdown 语法的正则表达式接口。
 * 顺序经过精心设计，以避免解析冲突（例如，代码块应最先匹配）。
 */
export interface MarkdownMarkRegex {
  CODE_BLOCK: RegExp;
  INLINE_CODE: RegExp;
  LINK: RegExp;
  BOLD_ASTERISK: RegExp;
  UNDERLINE_UNDERSCORE: RegExp;
  STRIKETHROUGH: RegExp;
  SPOILER: RegExp;
  BLOCKQUOTE_LINE: RegExp;
}

export interface FaqItem {
  keywordGroups: string[][];
  excludeKeywords?: string[][];
  answer: string;
}
