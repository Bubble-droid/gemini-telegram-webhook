import { converter } from 'tg-markdown-converter';

export const markdownToMarkdownV2Chunks = (markdown: string, splitAt = 4096): string[] =>
  converter(markdown, { splitAt });

export const markdownToMarkdownV2 = (markdown: string): string => converter(markdown);
