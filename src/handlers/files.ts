// src/handlers/files.ts

import type { Document, Message, PhotoSize, Video } from '@/types';
import type { Blob, BlobImageUnion } from '@google/genai';
import { AppError, config, bot, Log } from '@/services';
import * as path from 'path';

const SUPPORTED_MIME_TYPES = [
  'text/html',
  'text/css',
  'text/csv',
  'text/plain',
  'text/markdown',
  'application/json',
  'application/yaml',
  'application/javascript',
  'application/x-shellscript',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/mpeg',
];

const FILE_EXTENSION_MIME_MAP: Record<string, string> = {
  // Text
  txt: 'text/plain',
  html: 'text/html',
  css: 'text/css',
  csv: 'text/csv',
  md: 'text/markdown',
  js: 'application/javascript',
  json: 'application/json',
  yaml: 'application/yaml',
  yml: 'application/yaml',
  sh: 'application/x-shellscript',
  // Images
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  // Videos
  mp4: 'video/mp4',
  webm: 'video/webm',
  mpeg: 'video/mpeg',
};

/**
 * 获取 Telegram 文件的下载 URL
 * @param {string} fileId - Telegram 文件 ID
 * @param {string} botToken - Bot Token
 * @returns {Promise<string>}
 */
const getTelegramFileUrl = async (fileId: string, botToken: string): Promise<string> => {
  const result = await bot.getFile(fileId);
  if (!result.ok) {
    throw new AppError(`Failed to get file path for file_id: ${fileId}`, 'TELEGRAM_API_ERROR');
  }
  return `https://api.telegram.org/file/bot${botToken}/${result.data.file_path}`;
};

/**
 * Downloads a file from a given URL and returns it as a Blob.
 * @param {string} url - The URL of the file to download.
 * @returns {Promise<ArrayBuffer>} A Promise that resolves with the downloaded Blob.
 */
const downloadFileAsArrayBuffer = async (url: string): Promise<ArrayBuffer> => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new AppError(`Failed to download file: ${response.statusText} (${response.status})`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const fileSizeInBytes = arrayBuffer.byteLength;
    let displaySize: string;
    let displayUnit: string;
    if (fileSizeInBytes >= 1024 * 1024) {
      displaySize = (fileSizeInBytes / (1024 * 1024)).toFixed(2);
      displayUnit = 'MB';
    } else {
      displaySize = (fileSizeInBytes / 1024).toFixed(2);
      displayUnit = 'KB';
    }
    Log.info(`Successfully downloaded file. Size: ${displaySize} ${displayUnit}`);
    return arrayBuffer;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    Log.error(`Error downloading file from ${url}:`);
    throw new AppError(errorMessage, 'FILE_DOWNLOAD_ERROR');
  }
};

/**
 * 下载文件并编码为 Base64
 * @param {string} fileId - Telegram 文件 ID
 * @param {string} botToken - Bot Token
 * @param {string} mimeType - 文件的 MIME 类型
 * @returns {Promise<Blob | void>}
 */
const downloadAndEncodeFile = async (fileId: string, botToken: string, mimeType: string): Promise<Blob | void> => {
  const fileUrl = await getTelegramFileUrl(fileId, botToken);
  const arrayBuffer = await downloadFileAsArrayBuffer(fileUrl);
  const base64Data = Buffer.from(arrayBuffer).toString('base64');
  return { data: base64Data, mimeType };
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

export class FileHandler {
  private readonly message: Message;
  private readonly botToken: string;
  private readonly document?: Document;
  private readonly photo?: PhotoSize;
  private readonly video?: Video;

  constructor(message: Message) {
    const { document, photo, video } = message;
    this.document = document;
    this.photo = photo?.[photo.length - 1];
    this.video = video;
    this.message = message;
    this.botToken = config.load().botToken;

    Log.info('Handling file', { chatId: this.message.chat.id, messageId: this.message.message_id });
  }

  /**
   * 处理图片文件
   * @param {PhotoSize} photo - Telegram PhotoSize 数组
   * @returns {Promise<BlobImageUnion | void>}
   */
  private async handleImage(photo: PhotoSize): Promise<BlobImageUnion | void> {
    const { file_id } = photo;
    return downloadAndEncodeFile(file_id, this.botToken, 'image/jpeg');
  }

  /**
   * 处理视频文件
   * @param {Video} video - Telegram Video 对象
   * @returns {Promise<Blob | void>}
   */
  private async handleVideo(video: Video): Promise<Blob | void> {
    const { file_id } = video;
    return downloadAndEncodeFile(file_id, this.botToken, 'video/mp4');
  }

  /**
   * 处理文档文件
   * @param {Document} document - Telegram Document 对象
   * @returns {Promise<Blob | void>}
   */
  private async handleDocument(document: Document): Promise<Blob | void> {
    const { file_id, mime_type, file_name } = document;
    let determinedMimeType = mime_type;

    // 回退机制：如果 mime_type 不存在，则尝试通过文件后缀判断
    if (!determinedMimeType && file_name) {
      const ext = path.extname(file_name).toLowerCase().replace('.', '');
      if (ext && FILE_EXTENSION_MIME_MAP[ext]) {
        determinedMimeType = FILE_EXTENSION_MIME_MAP[ext];
        Log.info(`通过文件后缀 "${ext}" 确定 MIME 类型为 "${determinedMimeType}"`);
      }
    }

    let finalMimeType = determinedMimeType;

    if (!determinedMimeType || !SUPPORTED_MIME_TYPES.includes(String(determinedMimeType))) {
      if (determinedMimeType?.startsWith('text/')) {
        finalMimeType = 'text/plain';
      } else if (determinedMimeType?.startsWith('application/') && !isBinaryApplicationMime(determinedMimeType, { defaultToBinary: true })) {
        finalMimeType = 'text/plain';
      } else if (determinedMimeType?.startsWith('image/')) {
        finalMimeType = 'image/jpeg';
      } else if (determinedMimeType?.startsWith('video/')) {
        finalMimeType = 'video/mp4';
      } else {
        throw new AppError(`不支持的文件类型: ${determinedMimeType || file_name || '未知'}`, 'FILE_TYPE_NOT_SUPPORTED');
      }
    }
    return downloadAndEncodeFile(file_id, this.botToken, finalMimeType || 'application/octet-stream');
  }

  /**
   * 处理接收到的包含文件的 Telegram 消息 (如照片, 文档等)
   * @returns {Promise<Blob|void>} 处理后得到的数据，如果没有文件或处理失败则返回 null
   */
  public async process(): Promise<Blob | void> {
    if (this.photo) {
      return this.handleImage(this.photo);
    } else if (this.document) {
      return this.handleDocument(this.document);
    } else if (this.video) {
      return this.handleVideo(this.video);
    }
    return;
  }
}
