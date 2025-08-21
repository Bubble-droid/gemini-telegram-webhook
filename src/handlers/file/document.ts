import type { Document } from '@/types';
import { type Blob } from '@google/genai';
import { downloadFileAsArrayBuffer } from './downloader';
import { AppError, BotConfig, TelegramBot } from '@/services';

export const handleDocument = async (document: Document): Promise<Blob | void> => {
  const { botToken } = BotConfig.load();
  const { file_id, mime_type } = document;
  const supportedMimeTypes = ['application/json', 'application/yaml', 'text/javascript', 'text/plain', 'text/markdown', 'application/x-shellscript'];
  if (!supportedMimeTypes.includes(String(mime_type))) {
    const errorMessage = `不支持的文件类型：${mime_type}\n` + `目前仅支持处理 ${supportedMimeTypes.join(', ')} 类型的文件。`;
    throw new AppError(errorMessage, 'UNSUPPORTED_FILE_TYPE');
  }
  const documentData = await TelegramBot.getFile(file_id);
  if (documentData) {
    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${documentData.file_path}`;
    const documentArrayBuffer = await downloadFileAsArrayBuffer(fileUrl);
    const base64DocumentData = Buffer.from(documentArrayBuffer).toString('base64');
    return { data: base64DocumentData, mimeType: mime_type };
  }
};
