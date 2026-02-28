import { converter } from 'tg-markdown-converter';
import { TELEGRAM_CONVERTER_OPTIONS } from './config.js';

export const convertToMarkdownV2Chunks = (markdown: string): string[] => {
  return converter(markdown, TELEGRAM_CONVERTER_OPTIONS);
};

export const toMarkdownV2 = (markdown: string): string => {
  return convertToMarkdownV2Chunks(markdown).join('');
};
