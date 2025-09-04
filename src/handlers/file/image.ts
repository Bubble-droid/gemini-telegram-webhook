// src/handlers/file/image.ts

import { config, bot } from '@/services';
import type { PhotoSize } from '@/types';
import type { BlobImageUnion } from '@google/genai';
import { downloadFileAsArrayBuffer } from './downloader';

export const handleImage = async (image: PhotoSize[]): Promise<BlobImageUnion | void> => {
  const { botToken } = config.load();
  const { file_id } = image[image.length - 1];
  const result = await bot.getFile(file_id);
  if (result.ok) {
    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${result.data.file_path}`;
    const imageArrayBuffer = await downloadFileAsArrayBuffer(fileUrl);
    const base64ImageData = Buffer.from(imageArrayBuffer).toString('base64');
    return { data: base64ImageData, mimeType: 'image/jpeg' };
  }
};
