// src/handlers/files.ts

import type * as Bot from '@/types/telegram';
import type { Blob, BlobImageUnion } from '@google/genai';
import { AppError, config, bot, Log } from '@/services';
import * as path from 'path';

/**
 * @description 支持的 MIME 类型分组。
 * 文本类型（text/*）会被特殊处理，全部接受。
 * 其他类型仅接受明确列出的子类型。
 */
const SUPPORTED_MIME_TYPE = {
  APPLICATION_TYPES: ['json', 'x-javascript', 'pdf', 'zip'],
  IMAGE_TYPES: ['png', 'jpeg', 'webp', 'heic', 'heif'],
  VIDEO_TYPES: ['mp4', 'mpeg', 'mov', 'avi', 'x-flvc', 'mpg', 'webm', 'wmv', '3gpp'],
  AUDIO_TYPES: ['wav', 'mp3', 'aiff', 'aac', 'ogg', 'flac'],
};

/**
 * @description 文件扩展名到 MIME 类型的映射表。
 */
const FILE_EXTENSION_MIME_MAP: Record<string, string> = {
  // 文本与代码
  txt: 'text/plain',
  html: 'text/html',
  htm: 'text/html',
  vue: 'text/html',
  css: 'text/css',
  less: 'text/css',
  csv: 'text/csv',
  md: 'text/markdown',
  mdx: 'text/markdown',
  js: 'text/javascript',
  ts: 'text/javascript',
  jsx: 'text/javascript',
  tsx: 'text/javascript',
  json: 'application/json',
  jsonc: 'application/json',
  json5: 'application/json',
  yaml: 'application/yaml',
  yml: 'application/yaml',
  sh: 'application/x-shellscript',
  py: 'text/plain',
  java: 'text/plain',
  c: 'text/plain',
  cpp: 'text/plain',
  cs: 'text/plain',
  go: 'text/plain',
  php: 'text/plain',
  sql: 'text/plain',
  xml: 'application/xml',

  // 图片
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  gif: 'image/gif', // 特殊处理：将作为 video/mp4 发送

  // 视频
  mp4: 'video/mp4',
  webm: 'video/webm',
  mpeg: 'video/mpeg',
  mov: 'video/mov',
  avi: 'video/avi',
  mpg: 'video/mpg',
  '3gpp': 'video/3gpp',
  wmv: 'video/x-ms-wmv',
  'x-flv': 'video/x-flv',

  // 音频
  mp3: 'audio/mp3',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  aac: 'audio/aac',
  flac: 'audio/flac',
  aiff: 'audio/aiff',
};

/**
 * 获取 Telegram 文件的下载 URL
 * @param {string} fileId - Telegram 文件 ID
 * @param {string} botToken - Bot Token
 * @returns {Promise<string>}
 */
const getTelegramFileUrl = async (fileId: string, botToken: string): Promise<string> => {
  const result = await bot.getFile(fileId);
  if (!result.ok || !result.data.file_path) {
    throw new AppError(`获取文件路径失败: ${fileId}`, 'TELEGRAM_API_ERROR');
  }
  return `https://api.telegram.org/file/bot${botToken}/${result.data.file_path}`;
};

/**
 * 从给定 URL 下载文件并返回 ArrayBuffer
 * @param {string} url - 要下载的文件的 URL
 * @returns {Promise<ArrayBuffer>} 解析为已下载 Blob 的 Promise
 */
const downloadFileAsArrayBuffer = async (url: string): Promise<ArrayBuffer> => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new AppError(`文件下载失败: ${response.statusText} (${response.status})`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const fileSizeInBytes = arrayBuffer.byteLength;
    const displaySize =
      fileSizeInBytes >= 1024 * 1024 ? `${(fileSizeInBytes / (1024 * 1024)).toFixed(2)} MB` : `${(fileSizeInBytes / 1024).toFixed(2)} KB`;

    Log.info(`文件下载成功. 大小: ${displaySize}`);
    return arrayBuffer;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    Log.error(`从 ${url} 下载文件时出错:`);
    throw new AppError(errorMessage, 'FILE_DOWNLOAD_ERROR');
  }
};

/**
 * 下载文件并编码为 Base64
 * @param {string} fileId - Telegram 文件 ID
 * @param {string} botToken - Bot Token
 * @param {string} mimeType - 文件的 MIME 类型
 * @returns {Promise<Blob>}
 */
const downloadAndEncodeFile = async (fileId: string, botToken: string, mimeType: string): Promise<Blob> => {
  const fileUrl = await getTelegramFileUrl(fileId, botToken);
  const arrayBuffer = await downloadFileAsArrayBuffer(fileUrl);
  const base64Data = Buffer.from(arrayBuffer).toString('base64');
  return { data: base64Data, mimeType };
};

/**
 * 判断 application/* 类型的 MIME 是否属于二进制类型
 * @param {string} mime - 完整的 mime 字符串
 * @returns {boolean} - 如果是二进制则返回 true，否则返回 false
 */
const isBinaryApplicationMime = (mime: string): boolean => {
  if (!mime || typeof mime !== 'string') return true; // 默认视为二进制

  const clean = mime.split(';')[0].trim().toLowerCase();
  if (!clean.startsWith('application/')) {
    // 仅判断 application/*，非 application/* 类型不应使用此函数
    return true;
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
    'octet-stream',
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
    'wasm',
    'x-iso9660-image',
    'postscript',
  ]);

  // 直接命中明确集合
  if (textSet.has(subtype)) return false;
  if (binarySet.has(subtype)) return true;

  // 处理带 + 后缀的 subtype，例如 application/xyz+json
  if (subtype.includes('+')) {
    const suffix = subtype.split('+').pop();
    if (suffix && ['json', 'xml', 'javascript', 'ecmascript', 'xhtml+xml'].includes(suffix)) return false;
    if (suffix && ['zip', 'gzip', 'tar', 'pdf', 'wasm', 'octet-stream'].includes(suffix)) return true;
  }

  // 未识别的 vnd.* 通常为二进制（office、专用格式等）
  if (subtype.startsWith('vnd.')) return true;

  // 其他不常见的 application/*：保守地视为二进制
  return true;
};

export class FileHandler {
  private readonly message: Bot.Message;
  private readonly botToken: string;
  private readonly document?: Bot.Document;
  private readonly photo?: Bot.PhotoSize;
  private readonly video?: Bot.Video;
  private readonly audio?: Bot.Audio;
  private readonly voice?: Bot.Voice;

  constructor(message: Bot.Message) {
    const { document, photo, video, audio, voice } = message;
    this.document = document;
    this.photo = photo?.[photo.length - 1];
    this.video = video;
    this.audio = audio;
    this.voice = voice;
    this.message = message;
    this.botToken = config.load().botToken;

    Log.info('Handling file', { chatId: this.message.chat.id, messageId: this.message.message_id });
  }

  /**
   * 处理图片文件
   * @param {Bot.PhotoSize} photo - Telegram PhotoSize 对象
   * @returns {Promise<BlobImageUnion>}
   */
  private async handleImage(photo: Bot.PhotoSize): Promise<BlobImageUnion> {
    const { file_id } = photo;
    return downloadAndEncodeFile(file_id, this.botToken, 'image/jpeg');
  }

  /**
   * 处理视频文件
   * @param {Bot.Video} video - Telegram Video 对象
   * @returns {Promise<Blob>}
   */
  private async handleVideo(video: Bot.Video): Promise<Blob> {
    const { file_id, mime_type } = video;
    const finalMimeType = mime_type && SUPPORTED_MIME_TYPE.VIDEO_TYPES.includes(mime_type.split('/')[1]) ? mime_type : 'video/mp4';
    return downloadAndEncodeFile(file_id, this.botToken, finalMimeType);
  }

  /**
   * 处理音频文件 (包括 audio 和 voice)
   * @param {Bot.Audio | Bot.Voice} audioSource - Telegram Audio 或 Voice 对象
   * @param {'audio/mpeg' | 'audio/ogg'} defaultMimeType - 默认的 MIME 类型
   * @returns {Promise<Blob>}
   */
  private async handleAudio(audioSource: Bot.Audio | Bot.Voice, defaultMimeType: 'audio/mp3' | 'audio/ogg'): Promise<Blob> {
    const { file_id, mime_type } = audioSource;
    const finalMimeType = mime_type && SUPPORTED_MIME_TYPE.AUDIO_TYPES.includes(mime_type.split('/')[1]) ? mime_type : defaultMimeType;
    return downloadAndEncodeFile(file_id, this.botToken, finalMimeType);
  }

  /**
   * 处理文档文件
   * @param {Bot.Document} document - Telegram Document 对象
   * @returns {Promise<Blob>}
   */
  private async handleDocument(document: Bot.Document): Promise<Blob> {
    const { file_id, mime_type, file_name } = document;
    let determinedMimeType = mime_type;

    if (file_name) {
      const ext = path.extname(file_name).toLowerCase().replace('.', '');
      if (ext && FILE_EXTENSION_MIME_MAP[ext]) {
        determinedMimeType = FILE_EXTENSION_MIME_MAP[ext];
        Log.info(`通过文件后缀 "${ext}" 确定 MIME 类型为 "${determinedMimeType}"`);
      }
    }

    if (!determinedMimeType) {
      throw new AppError(`无法确定文件类型: ${file_name || '未知文件名'}`, 'FILE_TYPE_NOT_SUPPORTED');
    }

    if (determinedMimeType === 'image/gif') {
      Log.info('检测到 GIF 文件，将作为 video/mp4 类型处理');
      return downloadAndEncodeFile(file_id, this.botToken, 'video/mp4');
    }

    const [mainType, subType] = determinedMimeType.split('/');
    let finalMimeType: string | undefined;

    switch (mainType) {
      case 'text':
        finalMimeType = determinedMimeType;
        break;

      case 'application':
        if (SUPPORTED_MIME_TYPE.APPLICATION_TYPES.includes(subType)) {
          finalMimeType = determinedMimeType;
        } else if (!isBinaryApplicationMime(determinedMimeType)) {
          // 如果不是明确支持的，但通过检测被认为是“非二进制”的，则作为 text/plain 处理
          Log.info(`将无法直接处理的 application 类型 "${determinedMimeType}" 作为 text/plain 处理`);
          finalMimeType = 'text/plain';
        }
        // 如果是二进制的 application 类型，则 finalMimeType 保持 undefined，由后续逻辑抛出错误
        break;

      case 'image':
        if (SUPPORTED_MIME_TYPE.IMAGE_TYPES.includes(subType)) {
          finalMimeType = determinedMimeType;
        } else {
          finalMimeType = 'image/jpeg';
        }
        break;

      case 'video':
        if (SUPPORTED_MIME_TYPE.VIDEO_TYPES.includes(subType)) {
          finalMimeType = determinedMimeType;
        } else {
          finalMimeType = 'video/mp4';
        }
        break;

      case 'audio':
        if (SUPPORTED_MIME_TYPE.AUDIO_TYPES.includes(subType)) {
          finalMimeType = determinedMimeType;
        } else {
          finalMimeType = 'audio/mp3';
        }
        break;
    }

    if (!finalMimeType) {
      throw new AppError(`不支持的文件类型: ${determinedMimeType || '未知文件类型'}`, 'FILE_TYPE_NOT_SUPPORTED');
    }

    return downloadAndEncodeFile(file_id, this.botToken, finalMimeType);
  }

  /**
   * 处理接收到的包含文件的 Telegram 消息 (如照片, 文档等)
   * @returns {Promise<Blob|undefined>} 处理后得到的数据，如果没有文件或处理失败则返回 undefined
   */
  public async process(): Promise<Blob | undefined> {
    if (this.photo) return this.handleImage(this.photo);
    if (this.video) return this.handleVideo(this.video);
    if (this.audio) return this.handleAudio(this.audio, 'audio/mp3');
    if (this.voice) return this.handleAudio(this.voice, 'audio/ogg');
    if (this.document) return this.handleDocument(this.document);
    return undefined;
  }
}
