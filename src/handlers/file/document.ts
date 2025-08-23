// src/handlers/file/document.ts

import type { Document } from '@/types';
import { type Blob } from '@google/genai';
import { downloadFileAsArrayBuffer } from './downloader';
import { BotConfig, TelegramBot } from '@/services';

const SUPPORTED_MIME_TYPES = ['application/json', 'application/yaml', 'text/javascript', 'text/plain', 'text/markdown', 'application/x-shellscript'];

export const handleDocument = async (document: Document): Promise<Blob | void> => {
  const { botToken } = BotConfig.load();
  const { file_id, mime_type } = document;
  let generalMimeType: string | undefined;
  if (!SUPPORTED_MIME_TYPES.includes(String(mime_type))) generalMimeType = 'text/plain';
  const result = await TelegramBot.getFile(file_id);
  if (result.ok) {
    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${result.data.file_path}`;
    const documentArrayBuffer = await downloadFileAsArrayBuffer(fileUrl);
    const base64DocumentData = Buffer.from(documentArrayBuffer).toString('base64');
    return { data: base64DocumentData, mimeType: generalMimeType ? generalMimeType : mime_type ? mime_type : 'text/plain' };
  }
};
