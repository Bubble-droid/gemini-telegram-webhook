import { logger } from '@/services';
import type { Recordable } from '@/types';
import { URL } from 'node:url';

type PathTransformFn = (path: string) => string;

interface ProjectConfig {
  baseUrl: string;
  // 用于 sourcecode 类型的可选前缀 (如 /SagerNet/sing-box/blob/dev-next)
  repoPrefix?: string;
  // 自定义路径转换管道
  transforms?: PathTransformFn[];
}

interface ResolverConfig {
  docs: Recordable<ProjectConfig>;
  source: Recordable<ProjectConfig>;
}

// ----------------------------------------------------------------------
// Constants & Configuration (常量与配置)
// ----------------------------------------------------------------------

const GITHUB_BASE = 'https://github.com';

// 预定义通用的路径转换函数
const Transforms = {
  removeMdExtension: (p: string): string => p.replace(/\.md$/, ''),

  removeIndex: (p: string): string => p.replace(/index$/, ''),

  ensureTrailingSlash: (p: string): string => (p.endsWith('/') || p === '' ? p : `${p}/`),

  removeLeadingEn: (p: string): string => p.replace(/^\/?en\//, ''), // 处理 gui-for-cores 的 en 前缀

  // 处理 sing-box/hysteria2 的 .zh 后缀 -> /zh 前缀
  zhSuffixToPrefix: (p: string): string => {
    if (p.endsWith('.zh')) {
      return `/zh/${p.replace(/\.zh$/, '')}`;
    }
    return p;
  },

  // 处理 mihomo 的 .en 后缀 -> /en 前缀
  enSuffixToPrefix: (p: string): string => {
    if (p.endsWith('.en')) {
      return `/en/${p.replace(/\.en$/, '')}`;
    }
    return p;
  },

  // 标准化路径开头（移除开头的 /）
  normalizeStart: (p: string): string => p.replace(/^\/+/, ''),
};

// 组合常用的文档处理管道
const StandardDocPipeline = [Transforms.removeMdExtension, Transforms.removeIndex, Transforms.ensureTrailingSlash];

// 核心配置表
const CONFIG: ResolverConfig = {
  docs: {
    'gui-for-cores': {
      baseUrl: 'https://gui-for-cores.github.io',
      transforms: [Transforms.removeLeadingEn, ...StandardDocPipeline],
    },
    'sing-box': {
      baseUrl: 'https://sing-box.sagernet.org',
      transforms: [Transforms.zhSuffixToPrefix, ...StandardDocPipeline],
    },
    hysteria2: {
      baseUrl: 'https://v2.hysteria.network',
      transforms: [Transforms.zhSuffixToPrefix, ...StandardDocPipeline],
    },
    mihomo: {
      baseUrl: 'https://wiki.metacubex.one',
      transforms: [Transforms.enSuffixToPrefix, ...StandardDocPipeline],
    },
    anytls: {
      baseUrl: `${GITHUB_BASE}/anytls/anytls-go/blob/main`,
      transforms: [Transforms.normalizeStart],
    },
  },
  source: {
    'gui-for-singbox': {
      baseUrl: GITHUB_BASE,
      repoPrefix: '/GUI-for-Cores/GUI.for.SingBox/blob/main',
    },
    'gui-for-clash': {
      baseUrl: GITHUB_BASE,
      repoPrefix: '/GUI-for-Cores/GUI.for.Clash/blob/main',
    },
    'plugin-hub': {
      baseUrl: GITHUB_BASE,
      repoPrefix: '/GUI-for-Cores/Plugin-Hub/blob/main',
    },
    'sing-box': {
      baseUrl: GITHUB_BASE,
      repoPrefix: '/SagerNet/sing-box/blob/dev-next',
    },
    mihomo: {
      baseUrl: GITHUB_BASE,
      repoPrefix: '/MetaCubeX/mihomo/blob/Alpha',
    },
  },
};

const PATH_REGEX = /^(documents|sourcecode)\/([^/]+)(\/.*)?$/;

const resolveDocs = (project: string, relativePath: string, fallback: string): string => {
  const config = CONFIG.docs[project];
  if (!config) return fallback;

  // 应用转换管道 (Pipeline Pattern)
  const finalPath = (config.transforms ?? []).reduce((path, transform) => transform(path), relativePath);

  try {
    // 某些 docUrl 已经是完整路径（如 anytls），new URL 会正确处理
    const url = new URL(finalPath, config.baseUrl);
    return url.toString();
  } catch (err) {
    logger.warn(`Invalid URL construction: ${config.baseUrl} + ${finalPath}`, { err });
    return fallback;
  }
};

const resolveSource = (project: string, relativePath: string, fallback: string): string => {
  const config = CONFIG.source[project];
  if (!config) return fallback;

  try {
    // 组合完整路径部分
    const fullPath = `${config.repoPrefix ?? ''}/${relativePath}`;
    // 清理可能出现的重复斜杠 (// -> /)，但保留协议部分的 ://
    const cleanPath = fullPath.replace(/([^:]\/)\/+/g, '$1');

    const url = new URL(cleanPath, config.baseUrl);
    return url.toString();
  } catch (err) {
    logger.warn(`Invalid URL construction: ${config.baseUrl} + ${config.repoPrefix} + ${relativePath}`, { err });
    return fallback;
  }
};

export const resolvePath = (rawPath: string): string => {
  // 1. 使用正则解析路径结构
  const match = PATH_REGEX.exec(rawPath);

  if (!match) {
    return rawPath;
  }

  const [, category, project = '', restPath] = match;
  // restPath 可能为 undefined 或以 / 开头，标准化为无前导 /
  const rawRelativePath = restPath ? restPath.substring(1) : '';

  // 2. 分发处理逻辑

  if (category === 'documents') {
    return resolveDocs(project, rawRelativePath, rawPath);
  } else if (category === 'sourcecode') {
    return resolveSource(project, rawRelativePath, rawPath);
  }

  return rawPath;
};
