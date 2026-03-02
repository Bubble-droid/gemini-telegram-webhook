import { converter } from 'tg-markdown-converter';

export const markdownToMarkdownV2Chunks = (markdown: string): string[] => {
  return converter(markdown, { splitAt: 4096 });
};

export const markdownToMarkdownV2 = (markdown: string): string => {
  return markdownToMarkdownV2Chunks(markdown).join('');
};
