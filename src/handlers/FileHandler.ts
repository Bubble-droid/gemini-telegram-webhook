// src/handlers/FileHandler.ts

import { AppError, bot, config, logger } from '@/services';
import type * as Bot from '@/types/telegram';
import type { Blob } from '@google/genai';

// --- 常量定义 ---

const SUPPORTED_MIME_TYPE: Record<string, string[]> = {
  APPLICATION_TYPES: ['pdf'],
  IMAGE_TYPES: ['png', 'jpeg', 'webp', 'heic', 'heif'],
  VIDEO_TYPES: ['mp4', 'mpeg', 'mov', 'avi', 'x-flv', 'mpg', 'webm', 'wmv', '3gpp'],
  AUDIO_TYPES: ['wav', 'mp3', 'aiff', 'aac', 'ogg', 'flac'],
};

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
  py: 'text/plain',
  java: 'text/plain',
  c: 'text/plain',
  cpp: 'text/plain',
  cs: 'text/plain',
  go: 'text/plain',
  php: 'text/plain',
  sql: 'text/plain',
  xml: 'text/xml',
  json: 'application/json',
  jsonc: 'application/json',
  json5: 'application/json',
  yaml: 'application/yaml',
  yml: 'application/yaml',
  sh: 'application/x-shellscript',

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
  mpeg: 'video/mpeg',
  mov: 'video/mov',
  avi: 'video/avi',
  flv: 'video/x-flv',
  'x-flv': 'video/x-flv',
  mpg: 'video/mpg',
  webm: 'video/webm',
  wmv: 'video/wmv',
  '3gpp': 'video/3gpp',

  // 音频
  wav: 'audio/wav',
  mp3: 'audio/mp3',
  aiff: 'audio/aiff',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
};

const DEFAULT_FILE_NAME = 'downloaded_file';

/**
 * @class FileHandler
 * @description 处理 Telegram 文件下载、转换和 MIME 类型识别。
 *              采用无状态单例模式。
 */
class FileHandler {
  private botToken: string;
  private fileMimeMap: Map<string, string>;

  constructor() {
    this.botToken = config.botToken;
    this.fileMimeMap = new Map(Object.entries(FILE_EXTENSION_MIME_MAP));
  }

  /**
   * 获取文件扩展名 (不含点号)
   */
  private getExtension(fileName: string): string {
    const parts = fileName.split('.');
    return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
  }

  /**
   * 从 Content-Disposition 或 URL 中提取文件名
   */
  private extractFileName(contentDisposition: string | null, url: string): string {
    if (contentDisposition) {
      const regex = /filename="([^"]+)"|filename=([^;]+)/;
      const match = contentDisposition.match(regex);
      if (match) {
        return (match[1] || match[2]).trim();
      }
    }

    // Fallback: 从 URL 获取
    try {
      const urlPath = new URL(url).pathname;
      const lastPart = urlPath.split('/').pop();
      if (lastPart) return lastPart;
    } catch {}

    return DEFAULT_FILE_NAME;
  }

  /**
   * 判断 application/* 类型是否为二进制
   */
  private isBinaryApplicationMime(mime: string): boolean {
    if (!mime || typeof mime !== 'string') return true;

    const clean = mime.split(';')[0].trim().toLowerCase();
    if (!clean.startsWith('application/')) return true;

    const subtype = clean.slice('application/'.length);

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
      'x-msdownload',
      'x-shockwave-flash',
      'wasm',
      'x-iso9660-image',
      'postscript',
    ]);

    if (textSet.has(subtype)) return false;
    if (binarySet.has(subtype)) return true;

    if (subtype.includes('+')) {
      const suffix = subtype.split('+').pop();
      if (suffix && ['json', 'xml', 'javascript', 'ecmascript', 'xhtml+xml'].includes(suffix)) return false;
      if (suffix && ['zip', 'gzip', 'tar', 'pdf', 'wasm', 'octet-stream'].includes(suffix)) return true;
    }

    return !subtype.startsWith('vnd.');
  }

  /**
   * 下载文件流并转换为 Base64
   */
  private async downloadAndEncode(fileId: string, mimeType: string): Promise<Blob> {
    // 1. 获取 Telegram 文件路径
    const fileResult = await bot.getFile(fileId);
    if (!fileResult.ok || !fileResult.data.file_path) {
      throw new AppError(`获取文件路径失败: ${fileId}`, 'TELEGRAM_API_ERROR');
    }
    const fileUrl = `https://api.telegram.org/file/bot${this.botToken}/${fileResult.data.file_path}`;

    try {
      // 2. 下载文件
      const response = await fetch(fileUrl, { method: 'GET', redirect: 'follow' });
      if (!response.ok) {
        throw new AppError(`文件下载失败: ${response.statusText} (${response.status})`);
      }

      const arrayBuffer = await response.arrayBuffer();

      // 记录下载日志
      const fileSize = arrayBuffer.byteLength;
      const displaySize =
        fileSize >= 1048576 ? `${(fileSize / 1048576).toFixed(2)} MB` : `${(fileSize / 1024).toFixed(2)} KB`;
      logger.info(`文件下载成功 (${displaySize})`);

      // 3. 智能 MIME 类型修正
      let finalMimeType = mimeType;

      // 尝试根据实际下载的文件名修正 MIME
      const disposition = response.headers.get('content-disposition');
      const fileName = this.extractFileName(disposition, fileUrl);

      if (fileName !== DEFAULT_FILE_NAME) {
        const ext = this.getExtension(fileName);
        if (ext && this.fileMimeMap.get(ext)) {
          finalMimeType = this.fileMimeMap.get(ext) || mimeType;
          logger.info(`修正 MIME 类型: ${mimeType} -> ${finalMimeType} (基于扩展名 .${ext})`);
        }
      }

      // 4. 转换为 Base64
      const base64Data = Buffer.from(arrayBuffer).toString('base64');
      return { data: base64Data, mimeType: finalMimeType };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`下载文件失败: ${fileUrl}`, { err });
      throw new AppError(msg, 'FILE_DOWNLOAD_ERROR');
    }
  }

  // --- 特定类型处理器 ---

  private async handleImage(photo: Bot.PhotoSize): Promise<Blob> {
    // 始终使用 image/jpeg 作为照片的 MIME，Telegram API 通常返回 jpg
    return this.downloadAndEncode(photo.file_id, 'image/jpeg');
  }

  private async handleVideo(video: Bot.Video): Promise<Blob> {
    const { file_id, mime_type } = video;
    const mime =
      mime_type && SUPPORTED_MIME_TYPE.VIDEO_TYPES.includes(mime_type.split('/')[1]) ? mime_type : 'video/mp4';
    return this.downloadAndEncode(file_id, mime);
  }

  private async handleAudio(source: Bot.Audio | Bot.Voice, defaultMime: 'audio/mp3' | 'audio/ogg'): Promise<Blob> {
    const { file_id, mime_type } = source;
    const mime =
      mime_type && SUPPORTED_MIME_TYPE.AUDIO_TYPES.includes(mime_type.split('/')[1]) ? mime_type : defaultMime;
    return this.downloadAndEncode(file_id, mime);
  }

  private async handleDocument(document: Bot.Document): Promise<Blob> {
    const { file_id, mime_type, file_name } = document;
    let mime = mime_type;

    // 1. 优先尝试通过文件名后缀推断更准确的 MIME
    if (file_name) {
      const ext = this.getExtension(file_name);
      if (ext && FILE_EXTENSION_MIME_MAP[ext]) {
        mime = FILE_EXTENSION_MIME_MAP[ext];
        logger.info(`通过后缀推断文档 MIME: ${mime}`);
      }
    }

    if (!mime) {
      throw new AppError(`无法确定文件类型: ${file_name || '未知文件名'}`, 'FILE_TYPE_NOT_SUPPORTED');
    }

    // 2. 特殊逻辑：GIF 转 Video
    if (mime === 'image/gif') {
      logger.info('检测到 GIF，转为 video/mp4 处理');
      return this.downloadAndEncode(file_id, 'video/mp4');
    }

    const [mainType, subType] = mime.split('/');
    let finalMime: string | undefined;

    // 3. MIME 类型分类与验证
    switch (mainType) {
      case 'text':
        finalMime = mime;
        break;

      case 'application':
        if (SUPPORTED_MIME_TYPE.APPLICATION_TYPES.includes(subType)) {
          finalMime = mime; // e.g. application/pdf
        } else if (!this.isBinaryApplicationMime(mime)) {
          // 文本类的 application (如 application/json, application/javascript)
          // Google Gemini 接受 text/*，所以我们可以将其映射为 text/plain 或保留原样(如果 Gemini 支持)
          // 这里的策略是：如果是纯文本代码，统一按 text/plain 处理以确保兼容性
          logger.info(`非二进制 application 类型 "${mime}" -> 视为 text/plain`);
          finalMime = 'text/plain';
        }
        break;

      case 'image':
        finalMime = SUPPORTED_MIME_TYPE.IMAGE_TYPES.includes(subType) ? mime : 'image/jpeg';
        break;

      case 'video':
        finalMime = SUPPORTED_MIME_TYPE.VIDEO_TYPES.includes(subType) ? mime : 'video/mp4';
        break;

      case 'audio':
        finalMime = SUPPORTED_MIME_TYPE.AUDIO_TYPES.includes(subType) ? mime : 'audio/mp3';
        break;
    }

    if (!finalMime) {
      throw new AppError(`不支持的文件类型: ${mime}`, 'FILE_TYPE_NOT_SUPPORTED');
    }

    return this.downloadAndEncode(file_id, finalMime);
  }

  // --- 公共入口 ---

  /**
   * 处理消息中的附件
   * @public
   * @param message - Telegram 消息对象
   * @returns Promise<Blob | undefined>
   */
  public async handle(message: Bot.Message): Promise<Blob | undefined> {
    const { document, photo, video, audio, voice } = message;

    // 优先级：照片 > 视频 > 音频 > 语音 > 文档
    if (photo && photo.length > 0) {
      // 取最高分辨率的照片
      return this.handleImage(photo[photo.length - 1]);
    }
    if (video) return this.handleVideo(video);
    if (audio) return this.handleAudio(audio, 'audio/mp3');
    if (voice) return this.handleAudio(voice, 'audio/ogg');
    if (document) return this.handleDocument(document);

    return undefined;
  }
}

// 导出单例
export const fileHandler = new FileHandler();
