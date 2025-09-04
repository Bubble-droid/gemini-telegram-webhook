// src/handlers/file/document.ts

import type { Document } from '@/types';
import { type Blob } from '@google/genai';
import { downloadFileAsArrayBuffer } from './downloader';
import { AppError, config, bot } from '@/services';

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

export const handleDocument = async (document: Document): Promise<Blob | void> => {
  const { botToken } = config.load();
  const { file_id, mime_type } = document;
  let universalMimeType: string | undefined = undefined;
  if (!SUPPORTED_MIME_TYPES.includes(String(mime_type))) {
    if (mime_type?.startsWith('text/')) {
      universalMimeType = 'text/plain';
    } else if (mime_type?.startsWith('application/') && !isBinaryApplicationMime(mime_type, { defaultToBinary: true })) {
      universalMimeType = 'text/plain';
    } else if (mime_type?.startsWith('image/')) {
      universalMimeType = 'image/jpeg';
    } else if (mime_type?.startsWith('video/')) {
      universalMimeType = 'video/mp4';
    } else {
      throw new AppError(`不支持的文件类型: ${mime_type || '未知'}`, 'FILE_TYPE_NOT_SUPPORTED');
    }
  }
  const result = await bot.getFile(file_id);
  if (result.ok) {
    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${result.data.file_path}`;
    const documentArrayBuffer = await downloadFileAsArrayBuffer(fileUrl);
    const base64DocumentData = Buffer.from(documentArrayBuffer).toString('base64');
    return { data: base64DocumentData, mimeType: universalMimeType ? universalMimeType : mime_type };
  }
};

/**
 * 判断 application/* 类型的 MIME 是否属于二进制类型
 * @param {string} mime - 完整的 mime 字符串
 * @param {{defaultToBinary?: boolean}} opts - 可选配置
 * @returns {boolean}
 */
const isBinaryApplicationMime = (
  mime: string,
  opts?: {
    defaultToBinary?: boolean;
  },
): boolean => {
  const defaultToBinary = opts?.defaultToBinary ?? true;
  if (!mime || typeof mime !== 'string') return defaultToBinary;

  const clean = mime.split(';')[0].trim().toLowerCase();
  if (!clean.startsWith('application/')) {
    // 仅判断 application/*，非 application/* 的请在外部处理
    return defaultToBinary;
  }
  const subtype = clean.slice('application/'.length);

  // 常见明确为文本的 application/* 子类型
  const textSet = new Set([
    'json',
    'ld+json',
    'activity+json',
    'problem+json',
    'json-seq',
    'javascript',
    'ecmascript',
    'xml',
    'xhtml+xml',
    'rss+xml',
    'atom+xml',
    'x-www-form-urlencoded',
    'graphql',
    'graphql+json',
    'hal+json',
    'xml-dtd',
  ]);

  // 常见明确为二进制的 application/* 子类型
  const binarySet = new Set([
    'octet-stream', // application/octet-stream
    'pdf',
    'zip',
    'x-7z-compressed',
    'x-rar-compressed',
    'x-tar',
    'gzip',
    'x-gzip',
    'x-bzip2',
    'x-xz',
    'x-msdownload', // exe
    'x-shockwave-flash',
    'wasm', // webassembly
    'x-iso9660-image',
    'postscript',
  ]);

  // 直接命中明确集合
  if (textSet.has(subtype)) return false;
  if (binarySet.has(subtype)) return true;

  // 处理带 + 后缀的 subtype，例如 application/xyz+json 或 application/abc+zip
  if (subtype.includes('+')) {
    const parts = subtype.split('+');
    const suffix = parts[parts.length - 1];
    if (['json', 'xml', 'javascript', 'ecmascript', 'xhtml+xml'].includes(suffix)) return false;
    if (['zip', 'gzip', 'tar', 'pdf', 'wasm', 'octet-stream', 'x-xz', 'x-bzip2'].includes(suffix)) return true;
  }

  // 对 vendor types 做保守判断：
  //  - 如果是 vnd.* 且包含 +json/+xml 等已被处理过，上面会返回
  //  - 未识别的 vnd.* 通常为二进制（office、专用格式等），可以认为是二进制
  if (subtype.startsWith('vnd.')) return true;

  // 其他不常见的 application/*：
  // 返回默认值（通常设为 true，即保守地视为二进制）
  return defaultToBinary;
};
