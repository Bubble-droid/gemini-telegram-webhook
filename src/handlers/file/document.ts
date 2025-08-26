// src/handlers/file/document.ts

import type { Document } from '@/types';
import { type Blob } from '@google/genai';
import { downloadFileAsArrayBuffer } from './downloader';
import { AppError, BotConfig, TelegramBot } from '@/services';

const SUPPORTED_MIME_TYPES = [
  'text/html',
  'text/css',
  'text/csv',
  'text/plain',
  'text/markdown',
  'text/javascript',
  'text/x-javascript',
  'application/json',
  'application/yaml',
  'application/javascript',
  'application/x-javascript',
  'application/x-shellscript',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/mpeg',
];

const BINARY_MIME_TYPES = [
  // archives / compressed
  'application/zip',
  'application/x-7z-compressed',
  'application/gzip',
  'application/x-tar',
  'application/x-rar-compressed',
  'application/x-iso9660-image', // .iso
  // documents / containers (binary)
  'application/pdf',
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.ms-excel', // .xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-powerpoint', // .ppt
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx

  // executables / binary blobs
  'application/octet-stream',
  'application/x-msdownload', // .exe / windows installer
  'application/wasm', // WebAssembly
  'application/vnd.android.package-archive', // .apk
];

export const handleDocument = async (document: Document): Promise<Blob | void> => {
  const { botToken } = BotConfig.load();
  const { file_id, mime_type } = document;
  let universalMimeType: string | undefined = undefined;
  if (!SUPPORTED_MIME_TYPES.includes(String(mime_type))) {
    if (mime_type?.startsWith('text/')) {
      universalMimeType = 'text/plain';
    } else if (mime_type?.startsWith('application/') && !BINARY_MIME_TYPES.includes(mime_type)) {
      universalMimeType = 'text/plain';
    } else if (mime_type?.startsWith('image/')) {
      universalMimeType = 'image/jpeg';
    } else if (mime_type?.startsWith('video/')) {
      universalMimeType = 'video/mp4';
    } else {
      throw new AppError(`不支持的文件类型: ${mime_type || '未知'}`, 'FILE_TYPE_NOT_SUPPORTED');
    }
  }
  const result = await TelegramBot.getFile(file_id);
  if (result.ok) {
    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${result.data.file_path}`;
    const documentArrayBuffer = await downloadFileAsArrayBuffer(fileUrl);
    const base64DocumentData = Buffer.from(documentArrayBuffer).toString('base64');
    return { data: base64DocumentData, mimeType: universalMimeType ? universalMimeType : mime_type };
  }
};
