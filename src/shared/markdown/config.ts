import type { ConverterOptions } from 'node_modules/tg-markdown-converter/esm/src/types.js';

export const REGEX_CODE_BLOCK =
  /^[ \t]*(?<delimiter>`{3,6})(?<language>\w*)[ \t]*\n?(?<content>[\s\S]+?)\n?[ \t]*\k<delimiter>/my;

export const TELEGRAM_CONVERTER_OPTIONS = {
  splitAt: 4096,
} as const satisfies ConverterOptions;
