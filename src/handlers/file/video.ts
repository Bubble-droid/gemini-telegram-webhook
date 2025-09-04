// src/handlers/file/video

import type { Video } from '@/types';
import { type Blob } from '@google/genai';
import { downloadFileAsArrayBuffer } from './downloader';
import { config, bot } from '@/services';

export const handleVideo = async (video: Video): Promise<Blob | void> => {
  const { botToken } = config.load();
  const { file_id } = video;
  const result = await bot.getFile(file_id);
  if (result.ok) {
    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${result.data.file_path}`;
    const videoArrayBuffer = await downloadFileAsArrayBuffer(fileUrl);
    const base64VideoData = Buffer.from(videoArrayBuffer).toString('base64');
    return { data: base64VideoData, mimeType: 'video/mp4' };
  }
};
