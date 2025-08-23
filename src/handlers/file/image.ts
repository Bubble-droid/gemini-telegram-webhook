// src/handlers/file/image.ts

import { BotConfig, TelegramBot } from '@/services';
import type { Document } from '@/types';
import type { BlobImageUnion } from '@google/genai';
import { downloadFileAsArrayBuffer } from './downloader';

export const handleImage = async (image: Document): Promise<BlobImageUnion | void> => {
  const { botToken } = BotConfig.load();
  const { file_id, mime_type } = image;
  const result = await TelegramBot.getFile(file_id);
  if (result.ok) {
    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${result.data.file_path}`;
    const imageArrayBuffer = await downloadFileAsArrayBuffer(fileUrl);
    const base64ImageData = Buffer.from(imageArrayBuffer).toString('base64');
    return { data: base64ImageData, mimeType: mime_type ? mime_type : 'image/jpeg' };
  }
};
