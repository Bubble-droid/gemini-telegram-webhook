import { DATA_DIR, GITHUB_BASE_URL } from '@/configs/constant';
import { logger } from '@/services';
import type { Recordable } from '@/types';
import { join } from 'node:path';
import { env } from 'node:process';
import { URL } from 'node:url';
import { fetchFile, generateRawUrl, invertObject, readTextFile } from './helpers';

type PathTransformFn = (path: string) => string;

interface ProjectConfig {
  baseUrl: string;
  repoPrefix?: string;
  transforms?: PathTransformFn[];
}

interface ResolverConfig {
  docs: Recordable<ProjectConfig>;
  source: Recordable<ProjectConfig>;
}

const PATH_REGEX = /(documents|sourcecode)\/([^/]+)(\/.*)?$/;

const Transforms = {
  // 1. Normalize: Remove leading slashes
  normalizeStart: (p: string): string => p.replace(/^\/+/, ''),

  // 2. Remove .md extension (Must happen BEFORE locale processing)
  removeMdExtension: (p: string): string => p.replace(/\.md$/, ''),

  // 3. Locale: Convert .zh suffix to zh/ prefix
  // Input: "path/to/file.zh" (after .md removal) -> Output: "zh/path/to/file"
  zhSuffixToPrefix: (p: string): string => {
    if (p.endsWith('.zh')) {
      return `zh/${p.slice(0, -3)}`;
    }
    return p;
  },

  // 4. Locale: Convert .en suffix to en/ prefix
  enSuffixToPrefix: (p: string): string => {
    if (p.endsWith('.en')) {
      return `en/${p.slice(0, -3)}`;
    }
    return p;
  },

  // 5. Locale: Remove leading "en/" (legacy support)
  removeLeadingEn: (p: string): string => p.replace(/^en\//, ''),

  // 6. Clean Index: Remove 'index' from end of path
  // Handles: "index", "path/index", "zh/index" -> "", "path/", "zh/"
  removeIndex: (p: string): string => p.replace(/(^|\/)index$/, '$1'),

  // 7. Finalize: Ensure trailing slash for directory-style URLs
  ensureTrailingSlash: (p: string): string => {
    if (p === '') return ''; // Empty path relies on safeJoinUrl to add root slash
    return p.endsWith('/') ? p : `${p}/`;
  },
};

const RawFilePipeline = [Transforms.normalizeStart];

const RESOLVE_CONFIG: ResolverConfig = {
  docs: {
    'gui-for-cores': {
      baseUrl: 'https://gui-for-cores.github.io',
      transforms: [
        Transforms.normalizeStart,
        Transforms.removeMdExtension,
        Transforms.removeLeadingEn, // Special case
        Transforms.removeIndex,
        Transforms.ensureTrailingSlash,
      ],
    },
    'sing-box': {
      baseUrl: 'https://sing-box.sagernet.org',
      transforms: [
        Transforms.normalizeStart,
        Transforms.removeMdExtension,
        Transforms.zhSuffixToPrefix, // .zh -> zh/
        Transforms.removeIndex,
        Transforms.ensureTrailingSlash,
      ],
    },
    hysteria2: {
      baseUrl: 'https://v2.hysteria.network',
      transforms: [
        Transforms.normalizeStart,
        Transforms.removeMdExtension,
        Transforms.zhSuffixToPrefix, // .zh -> zh/
        Transforms.removeIndex,
        Transforms.ensureTrailingSlash,
      ],
    },
    mihomo: {
      baseUrl: 'https://wiki.metacubex.one',
      transforms: [
        Transforms.normalizeStart,
        Transforms.removeMdExtension,
        Transforms.enSuffixToPrefix, // .en -> en/
        Transforms.removeIndex,
        Transforms.ensureTrailingSlash,
      ],
    },
    anytls: {
      baseUrl: `${GITHUB_BASE_URL}/anytls/anytls-go/blob/main`,
      // anytls points to source blobs, so we MUST keep extensions
      transforms: RawFilePipeline,
    },
  },
  source: {
    'gui-for-singbox': {
      baseUrl: GITHUB_BASE_URL,
      repoPrefix: 'GUI-for-Cores/GUI.for.SingBox/blob/main',
    },
    'gui-for-clash': {
      baseUrl: GITHUB_BASE_URL,
      repoPrefix: 'GUI-for-Cores/GUI.for.Clash/blob/main',
    },
    'plugin-hub': {
      baseUrl: GITHUB_BASE_URL,
      repoPrefix: 'GUI-for-Cores/Plugin-Hub/blob/main',
    },
    'sing-box': {
      baseUrl: GITHUB_BASE_URL,
      repoPrefix: 'SagerNet/sing-box/blob/dev-next',
    },
    mihomo: {
      baseUrl: GITHUB_BASE_URL,
      repoPrefix: 'MetaCubeX/mihomo/blob/Alpha',
    },
  },
};

const FILE_ID_PATH = join(DATA_DIR, 'file-id-map.json');

const loadFileIdMap = async (): Promise<Map<string, string>> => {
  let fileIds: Recordable<string> = {};
  if (env['NODE_ENV'] === 'development') {
    const data = await readTextFile(FILE_ID_PATH);
    fileIds = JSON.parse(data) as unknown as Recordable<string>;
  } else {
    const url = generateRawUrl(FILE_ID_PATH);
    fileIds = (await fetchFile(url, 'json', {
      method: 'GET',
      redirect: 'follow',
    })) as unknown as Recordable<string>;
  }
  const idToFile = invertObject(fileIds);
  return new Map(Object.entries(idToFile));
};

const FILE_ID_MAP = await loadFileIdMap();

const safeJoinUrl = (baseUrl: string, relativePath: string): string => {
  const base = new URL(baseUrl);
  const cleanRelative = relativePath.replace(/^\/+/, '');

  const separator = base.pathname.endsWith('/') ? '' : '/';

  base.pathname = `${base.pathname}${separator}${cleanRelative}`.replace(/\/\//g, '/');
  return base.toString();
};

const resolveDocs = (project: string, relativePath: string, fallback: string): string => {
  const config = RESOLVE_CONFIG.docs[project];
  if (!config) return fallback;

  // Execute Pipeline
  const finalPath = (config.transforms ?? []).reduce((path, transform) => transform(path), relativePath);

  try {
    return safeJoinUrl(config.baseUrl, finalPath);
  } catch (err) {
    logger.warn(`Invalid URL in resolveDocs: ${config.baseUrl} + ${finalPath}`, { err });
    return fallback;
  }
};

const resolveSource = (project: string, relativePath: string, fallback: string): string => {
  const config = RESOLVE_CONFIG.source[project];
  if (!config) return fallback;

  try {
    const prefix = (config.repoPrefix ?? '').replace(/^\/+|\/+$/g, '');
    const cleanRelative = relativePath.replace(/^\/+/, '');
    const combinedPath = prefix ? `${prefix}/${cleanRelative}` : cleanRelative;

    return safeJoinUrl(config.baseUrl, combinedPath);
  } catch (err) {
    logger.warn(`Invalid URL in resolveSource`, { err });
    return fallback;
  }
};

export const resolvePath = (rawId: string): string => {
  const cleanId = rawId.split('-0-0-')[1];
  if (!cleanId) return 'N/A';
  logger.debug(`Resolving path for ID: ${cleanId}`);

  const rawPath = FILE_ID_MAP.get(cleanId);
  if (!rawPath) return 'N/A';
  logger.debug(`Found path: ${rawPath}`);

  const cleanPath = rawPath.replace(/^\/data\//, '').replace(/^\/+/, '');
  const match = PATH_REGEX.exec(cleanPath);

  if (!match) return rawPath;

  const [, category, project, restPath] = match;
  const rawRelativePath = restPath ? restPath.substring(1) : '';

  if (category === 'documents') {
    return resolveDocs(project!, rawRelativePath, rawPath);
  } else if (category === 'sourcecode') {
    return resolveSource(project!, rawRelativePath, rawPath);
  }

  return rawPath;
};
