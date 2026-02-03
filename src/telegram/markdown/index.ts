import type { ParseMode } from 'grammy/types';
import { Formatter } from './Formatter';
import { splitMdastToChunks, splitPlainText } from './splitter';

export const formatter = new Formatter();

export const getFormattedChunks = (text: string, parseMode: ParseMode): string[] => {
  const ast = formatter.parse(text);
  const generator = formatter.getGenerator(parseMode);
  return splitMdastToChunks(ast, generator);
};

export const getHtmlChunks = (text: string): string[] => {
  return getFormattedChunks(text, 'HTML');
};

export const getPlainTextChunks = (text: string): string[] => {
  return splitPlainText(text);
};

const convertFormat = (text: string, parseMode: ParseMode): string => {
  const chunks = getFormattedChunks(text, parseMode);
  return chunks.join('');
};

export const toHtml = (text: string): string => {
  return convertFormat(text, 'HTML');
};

export const toMarkdownV2 = (text: string): string => {
  return convertFormat(text, 'MarkdownV2');
};
