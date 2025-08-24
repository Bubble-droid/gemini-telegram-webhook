// src/handlers/file/index.ts

import type { Message } from '@/types';
import type { Blob } from '@google/genai';
import { handleImage } from './image';
import { handleDocument } from './document';

export * from './document';
export * from './image';
export * from './downloader';

/**
 * 处理接收到的包含文件的 Telegram 消息 (如照片, 文档等)
 * @param {Message} message - Telegram Message 对象 (包含文件信息)
 * @returns {Promise<Blob|null>} 处理后得到的数据，如果没有文件或处理失败则返回 null
 */
export const handleFile = async (message: Message): Promise<Blob | void> => {
  const { document, photo } = message;
  if (photo || document?.mime_type === 'image/png' || document?.mime_type === 'image/jpeg') {
    const image = photo ? photo[photo.length - 1] : document;
    if (image) {
      const imageData = await handleImage(image);
      if (imageData) return imageData;
    }
  } else if (document) {
    const documentData = await handleDocument(document);
    if (documentData) return documentData;
  }
};
