// src/utils/github_api.ts

import type * as Github from '@/types/github';
import { config, Log } from '@/services';

/**
 * 封装通用的 GitHub API 请求。
 * @param {Github.ApiRequestOptions} options - 请求的 URL。
 * @returns {Promise<Github.ApiResponse<T>>} 包含成功数据或错误信息的 Promise。
 */
const makeGitHubApiRequest = async <T>(options: Github.ApiRequestOptions): Promise<Github.ApiResponse<T>> => {
  const { githubToken } = config.load();
  const { method, urlPath, queryParams } = options;
  const apiUrl = new URL('https://api.github.com');
  apiUrl.pathname = urlPath;
  if (queryParams) apiUrl.search = queryParams.toString();
  Log.info(`尝试通过 GitHub API 请求: ${apiUrl}`);
  try {
    const response = await fetch(apiUrl, {
      method,
      headers: {
        Accept: 'application/vnd.github+json', // GitHub API 推荐的 Accept 头
        Authorization: `Bearer ${githubToken}`,
        'User-Agent': 'Gemini-Telegram-Bot', // GitHub API 要求 User-Agent
      },
      redirect: 'follow',
    });
    if (!response.ok) {
      const errorText = await response.text();
      Log.warn(`GitHub API 请求失败，状态码: ${response.status}, 错误: ${errorText}, URL: ${apiUrl}`);
      return {
        success: false,
        error: `GitHub API 请求失败 (状态码: ${response.status}) - ${errorText}`,
      };
    }

    const data = (await response.json()) as T;
    return { success: true, data };
  } catch (fetchError: unknown) {
    const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
    Log.error(`GitHub API 请求时发生网络错误: ${errorMessage}, URL: ${apiUrl}`);
    return {
      success: false,
      error: `GitHub API 请求时发生网络错误 - ${errorMessage || '未知错误'}`,
    };
  }
};

/**
 * 封装对 GitHub 原始文件内容的请求（如 raw.githubusercontent.com）。
 * @param {string} rawPath - 原始文件内容的 URL。
 * @returns {Promise<Github.ApiResponse<string>>} 包含文件内容字符串或错误信息的 Promise。
 */
const makeRawFileRequest = async (rawPath: string): Promise<Github.ApiResponse<string>> => {
  Log.info(`尝试获取原始文件内容: ${rawPath}`);
  const { githubToken } = config.load();
  const rawUrl = new URL(`https://raw.githubusercontent.com`);
  rawUrl.pathname = `/${rawPath}`;
  try {
    const response = await fetch(rawUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${githubToken}`,
        'User-Agent': 'Gemini-Telegram-Bot',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      Log.warn(`获取原始文件内容失败，状态码: ${response.status}, PATH: ${rawPath}`);
      return {
        success: false,
        error: `无法获取文件内容 (状态码: ${response.status})`,
      };
    }

    const content = await response.text();
    return { success: true, data: content };
  } catch (fetchError: unknown) {
    const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
    Log.error(`获取原始文件时发生网络错误: ${errorMessage}, PATH: ${rawPath}`);
    return {
      success: false,
      error: `获取原始文件时发生网络错误 - ${errorMessage || '未知错误'}`,
    };
  }
};

export { makeGitHubApiRequest, makeRawFileRequest };
