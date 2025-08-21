// src/handlers/file/downloader.ts

import { AppError, Log } from '@/services';

/**
 * Downloads a file from a given URL and returns it as a Blob.
 * @param {string} url - The URL of the file to download.
 * @returns {Promise<ArrayBuffer>} A Promise that resolves with the downloaded Blob.
 */
export const downloadFileAsArrayBuffer = async (url: string): Promise<ArrayBuffer> => {
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
