// src/handlers/FileHandler.ts

import { config, logger } from '@/services';
import { bot } from '@/services/apis';
import type { Recordable } from '@/types';
import { AppError } from '@/utils/errors';
import type { Blob as GBlob } from '@google/genai';
import type { Animation, Audio, Document, Message, PhotoSize, Sticker, Video, Voice } from 'grammy/types';
import path from 'node:path';

const DEFAULT_FILE_NAME = 'downloaded_file';

const SupportedMimeType = {
  ApplicationTypes: ['pdf'],
  ImageTypes: ['png', 'jpeg', 'webp', 'heic', 'heif'],
  VideoTypes: ['mp4', 'mpeg', 'mov', 'avi', 'x-flv', 'mpg', 'webm', 'wmv', '3gpp'],
  AudioTypes: ['wav', 'mp3', 'aiff', 'aac', 'ogg', 'flac'],
};

const FILE_EXT_MIMES = {
  // 文本与代码
  txt: 'text/plain',

  py: 'text/plain',
  java: 'text/plain',
  c: 'text/plain',
  cpp: 'text/plain',
  cs: 'text/plain',
  go: 'text/plain',
  php: 'text/plain',
  sql: 'text/plain',

  html: 'text/html',
  htm: 'text/html',
  vue: 'text/html',

  css: 'text/css',
  csv: 'text/csv',

  md: 'text/markdown',
  mdx: 'text/markdown',

  js: 'text/javascript',
  jsx: 'text/javascript',

  xml: 'text/xml',

  yaml: 'text/yaml',
  yml: 'text/yaml',

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
} as const satisfies Recordable<string>;

type FileExtension = keyof typeof FILE_EXT_MIMES;
type MimeType = (typeof FILE_EXT_MIMES)[FileExtension];

/**
 * @class FileHandler
 * @description 处理 Telegram 文件下载、转换和 MIME 类型识别。
 *              采用无状态单例模式。
 */
class FileHandler {
  private botToken: string;
  private extMimeMap = new Map<string, MimeType>(Object.entries(FILE_EXT_MIMES));

  constructor() {
    this.botToken = config.botToken;
  }

  /**
   * 处理消息中的附件
   * @param message - Telegram 消息对象
   */
  public async handle(message: Message): Promise<GBlob | undefined> {
    const { sticker, animation, document, photo, video, audio, voice } = message;

    const largePhoto = photo?.[photo.length - 1];

    if (largePhoto) return this.handleImage(largePhoto);
    if (sticker) return this.handleSticker(sticker);
    if (animation) return this.handleAnimation(animation);
    if (video) return this.handleVideo(video);
    if (audio) return this.handleAudio(audio, 'audio/mp3');
    if (voice) return this.handleAudio(voice, 'audio/ogg');
    if (document) return this.handleDocument(document);

    return undefined;
  }

  /**
   * 获取文件扩展名 (不含点号)
   */
  private getExtension(fileName: string): string {
    return path.extname(fileName).slice(1).toLowerCase();
  }

  /**
   * 从 Content-Disposition 或 URL 中提取文件名
   */
  private extractFileName(contentDisposition: string | null, url: string): string {
    if (contentDisposition) {
      const regex = /filename="([^"]+)"|filename=([^;]+)/;
      const match = regex.exec(contentDisposition);
      if (match) {
        return (match[1] ?? match[2])?.trim() ?? '';
      }
    }

    // Fallback: 从 URL 获取

    const urlPath = new URL(url).pathname;
    const lastPart = path.basename(urlPath);
    if (lastPart) return lastPart;

    return DEFAULT_FILE_NAME;
  }

  /**
   * 判断 application/* 类型是否为二进制
   */
  private isBinaryApplicationMime(mime: string): boolean {
    if (!mime || typeof mime !== 'string') return true;

    const clean = mime.split(';')[0]?.trim().toLowerCase();
    if (!clean?.startsWith('application/')) return true;

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
  private async downloadAndEncode(fileId: string, mimeType: MimeType): Promise<GBlob> {
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
      logger.debug(`文件下载成功 (${displaySize})`);

      let finalMimeType: MimeType = mimeType;

      // 尝试根据实际下载的文件名修正 MIME
      const disposition = response.headers.get('content-disposition');
      const fileName = this.extractFileName(disposition, fileUrl);

      if (fileName !== DEFAULT_FILE_NAME) {
        const ext = this.getExtension(fileName);
        finalMimeType = this.extMimeMap.get(ext) ?? mimeType;
        logger.debug(`修正 MIME 类型: ${mimeType} -> ${finalMimeType} (基于扩展名 .${ext})`);
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

  private handleSticker(sticker: Sticker): Promise<GBlob> {
    const isImageSticker = !sticker.is_animated && !sticker.is_video;
    return this.downloadAndEncode(sticker.file_id, isImageSticker ? 'image/webp' : 'video/webm');
  }

  private handleAnimation(animation: Animation): Promise<GBlob> {
    return this.downloadAndEncode(animation.file_id, 'video/mp4');
  }

  private handleImage(photo: PhotoSize): Promise<GBlob> {
    return this.downloadAndEncode(photo.file_id, 'image/jpeg');
  }

  private handleVideo(video: Video): Promise<GBlob> {
    const { file_id, mime_type } = video;
    const mime =
      mime_type && SupportedMimeType.VideoTypes.includes(mime_type.split('/')[1] ?? '') ? mime_type : 'video/mp4';
    return this.downloadAndEncode(file_id, mime as MimeType);
  }

  private handleAudio(source: Audio | Voice, defaultMime: 'audio/mp3' | 'audio/ogg'): Promise<GBlob> {
    const { file_id, mime_type } = source;
    const mime =
      mime_type && SupportedMimeType.AudioTypes.includes(mime_type.split('/')[1] ?? '') ? mime_type : defaultMime;
    return this.downloadAndEncode(file_id, mime as MimeType);
  }

  private handleDocument(document: Document): Promise<GBlob> {
    const { file_id, mime_type, file_name } = document;
    let mime: string | undefined = mime_type;

    // 1. 优先尝试通过文件名后缀推断更准确的 MIME
    if (!mime_type && file_name) {
      const ext = this.getExtension(file_name);
      mime = this.extMimeMap.get(ext);
    }

    if (!mime) {
      throw new AppError(`无法确定文件类型: ${file_name ?? 'N/A'}`, 'FILE_TYPE_NOT_SUPPORTED');
    }

    // 2. 特殊逻辑：GIF 转 Video
    if (mime === 'image/gif') {
      logger.debug('检测到 GIF，转为 video/mp4 处理');
      return this.downloadAndEncode(file_id, 'video/mp4');
    }

    const [mainType, subType = ''] = mime.split('/');
    let finalMime: string | undefined;

    // 3. MIME 类型分类与验证
    switch (mainType) {
      case 'text':
        finalMime = 'text/plain';
        break;

      case 'application':
        if (SupportedMimeType.ApplicationTypes.includes(subType)) {
          finalMime = mime; // e.g. application/pdf
        } else if (!this.isBinaryApplicationMime(mime)) {
          logger.debug(`非二进制 application 类型 "${mime}" -> 视为 text/plain`);
          finalMime = 'text/plain';
        }
        break;

      case 'image':
        finalMime = SupportedMimeType.ImageTypes.includes(subType) ? mime : undefined;
        break;

      case 'video':
        finalMime = SupportedMimeType.VideoTypes.includes(subType) ? mime : undefined;
        break;

      case 'audio':
        finalMime = SupportedMimeType.AudioTypes.includes(subType) ? mime : undefined;
        break;
    }

    if (!finalMime) {
      throw new AppError(`不支持的文件类型: ${mime}`, 'FILE_TYPE_NOT_SUPPORTED');
    }

    return this.downloadAndEncode(file_id, finalMime as MimeType);
  }
}

// 导出单例
export const fileHandler = new FileHandler();
