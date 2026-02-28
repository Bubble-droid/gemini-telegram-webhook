import { type Blob as GBlob, type Part } from '@google/genai';
import type { Animation, Audio, Document, Message, PhotoSize, Sticker, Video, Voice } from '@grammyjs/types';
import { CONFIG } from '@shared/core/config.js';
import { FILE_EXT_MIMES, SUPPORTED_MIME_TYPES, TELEGRAM_BASE_URL } from '@shared/core/constants.js';
import { DataError, HttpError } from '@shared/core/errors.js';
import { logger } from '@shared/core/logger.js';
import { httpRequest } from '@shared/utils/http.js';
import type { TelegramBotApi } from '@telegram/bot/telegram-bot-api.js';
import path from 'node:path';

type FileExtension = keyof typeof FILE_EXT_MIMES;
type MimeType = (typeof FILE_EXT_MIMES)[FileExtension];

const DEFAULT_FILE_NAME = 'downloaded_file';

export class FileHandler {
  private api: TelegramBotApi;
  private extMimeMap = new Map<string, MimeType>(Object.entries(FILE_EXT_MIMES));

  constructor(api: TelegramBotApi) {
    this.api = api;
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

    return;
  }

  public async batchProcessFiles(messages: Message[], predicate: (msg: Message) => boolean): Promise<Part[]> {
    const mediaPromises = messages.filter(predicate).map(async (msg) => {
      try {
        const fileData = await this.handle(msg);
        return fileData ? { inlineData: fileData } : null;
      } catch (err) {
        logger.warn('Failed to process media file:', { err, msgId: msg.message_id });
        return null;
      }
    });

    if (mediaPromises.length === 0) return [];
    const results = await Promise.all(mediaPromises);
    return results.filter((r) => !!r);
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
    const fileResult = await this.api.getFile(fileId);
    if (!fileResult.ok || !fileResult.data.file_path) {
      throw new HttpError(`获取文件路径失败: ${fileId}`);
    }
    const fileUrl = this.generateFileUrl(fileResult.data.file_path);
    try {
      // 2. 下载文件
      const { headers, data } = await httpRequest(fileUrl, {
        method: 'GET',
        redirect: 'follow',
        responseType: 'arrayBuffer',
      });

      // 记录下载日志
      const fileSize = data.byteLength;
      const displaySize =
        fileSize >= 1048576 ? `${(fileSize / 1048576).toFixed(2)} MB` : `${(fileSize / 1024).toFixed(2)} KB`;
      logger.debug(`文件下载成功 (${displaySize})`);

      let finalMimeType: MimeType = mimeType;

      // 尝试根据实际下载的文件名修正 MIME
      const disposition = headers.get('content-disposition');
      const fileName = this.extractFileName(disposition, fileUrl);

      if (fileName !== DEFAULT_FILE_NAME) {
        const ext = this.getExtension(fileName);
        finalMimeType = this.extMimeMap.get(ext) ?? mimeType;
        logger.debug(`修正 MIME 类型: ${mimeType} -> ${finalMimeType} (基于扩展名 .${ext})`);
      }

      const base64Data = Buffer.from(data).toString('base64');
      return { data: base64Data, mimeType: finalMimeType };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`下载文件失败: ${fileUrl}`, { err });
      throw new HttpError(msg);
    }
  }

  private generateFileUrl(path: string): string {
    return `${TELEGRAM_BASE_URL}/file/bot${CONFIG.TELEGRAM_BOT_TOKEN}/${path}`;
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
      mime_type && SUPPORTED_MIME_TYPES.VideoTypes.includes(mime_type.split('/')[1] ?? '') ? mime_type : 'video/mp4';
    return this.downloadAndEncode(file_id, mime as MimeType);
  }

  private handleAudio(source: Audio | Voice, defaultMime: 'audio/mp3' | 'audio/ogg'): Promise<GBlob> {
    const { file_id, mime_type } = source;
    const mime =
      mime_type && SUPPORTED_MIME_TYPES.AudioTypes.includes(mime_type.split('/')[1] ?? '') ? mime_type : defaultMime;
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
      throw new DataError(`无法确定文件类型: ${file_name ?? 'N/A'}`);
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
        if (SUPPORTED_MIME_TYPES.AppTypes.includes(subType)) {
          finalMime = mime; // e.g. application/pdf
        } else if (!this.isBinaryApplicationMime(mime)) {
          logger.debug(`非二进制 application 类型 "${mime}" -> 视为 text/plain`);
          finalMime = 'text/plain';
        }
        break;

      case 'image':
        finalMime = SUPPORTED_MIME_TYPES.ImageTypes.includes(subType) ? mime : undefined;
        break;

      case 'video':
        finalMime = SUPPORTED_MIME_TYPES.VideoTypes.includes(subType) ? mime : undefined;
        break;

      case 'audio':
        finalMime = SUPPORTED_MIME_TYPES.AudioTypes.includes(subType) ? mime : undefined;
        break;
    }

    if (!finalMime) {
      throw new DataError(`不支持的文件类型: ${mime}`);
    }

    return this.downloadAndEncode(file_id, finalMime as MimeType);
  }
}
