// src/configs/gemini_tools.ts

import type { FunctionDeclaration, Tool } from '@google/genai';
import { Type, Behavior } from '@google/genai';

const functionForSearch: FunctionDeclaration[] = [
  {
    name: 'searchFilesInRepo',
    description: '根据关键词在指定的 GitHub 仓库、分支和特定路径下搜索文件内容，以获取相关文件路径。',
    behavior: Behavior.BLOCKING,
    parameters: {
      type: Type.OBJECT,
      title: 'Search GitHub Repository Files By Keyword Parameters',
      properties: {
        keyword: {
          type: Type.STRING,
          description: '用于搜索文件内容的关键词，多个关键词请用 AND 或 OR 分隔，例如 "路由 AND 拦截"。',
          example: '路由 AND 拦截',
        },
        owner: {
          type: Type.STRING,
          description: 'GitHub 仓库所有者，例如 "SagerNet"。',
          example: 'SagerNet',
        },
        repo: {
          type: Type.STRING,
          description: 'GitHub 仓库名称，例如 "sing-box"。',
          example: 'sing-box',
        },
        branch: {
          type: Type.STRING,
          description: '要搜索的仓库分支，默认为仓库默认分支（如 main 或 master）。',
          default: 'main',
          example: 'main',
        },
      },
      required: ['keyword', 'owner', 'repo'],
    },
  },
  {
    name: 'searchCommitsInRepo',
    description: '根据关键词在指定的 GitHub 仓库内搜索提交记录（Commit），返回匹配的提交列表。',
    behavior: Behavior.BLOCKING,
    parameters: {
      type: Type.OBJECT,
      title: 'Search GitHub Commits By Keyword Parameters',
      properties: {
        keyword: {
          type: Type.STRING,
          description: '用于搜索提交消息内容的关键词，多个关键词请用 AND 或 OR 分隔，例如 "fix AND bug"。',
          example: 'fix AND bug',
        },
        owner: {
          type: Type.STRING,
          description: 'GitHub 仓库所有者，例如 "SagerNet"。',
          example: 'SagerNet',
        },
        repo: {
          type: Type.STRING,
          description: 'GitHub 仓库名称，例如 "sing-box"。',
          example: 'sing-box',
        },
      },
      required: ['keyword', 'owner', 'repo'],
    },
  },
  {
    name: 'searchIssuesInRepo',
    description: '根据关键词在指定的 GitHub 仓库内搜索 Issue，并可根据状态返回匹配的 Issue 列表。',
    behavior: Behavior.BLOCKING,
    parameters: {
      type: Type.OBJECT,
      title: 'Search GitHub Issues Parameters',
      properties: {
        keyword: {
          type: Type.STRING,
          description: '用于搜索 Issue 内容和标题的关键词，多个关键词请用 AND 或 OR 分隔，例如 "tun AND error"。',
          example: 'tun AND error',
        },
        owner: {
          type: Type.STRING,
          description: 'GitHub 仓库所有者，例如 "SagerNet"。',
          example: 'SagerNet',
        },
        repo: {
          type: Type.STRING,
          description: 'GitHub 仓库名称，例如 "sing-box"。',
          example: 'sing-box',
        },
        state: {
          type: Type.STRING,
          description: 'Issue 的状态，可以是 "open"（开放）、"closed"（关闭），默认为 "open"。',
          default: 'open',
          enum: ['open', 'closed'],
          example: 'open',
        },
      },
      required: ['keyword', 'owner', 'repo'],
    },
  },
];

const functionForList: FunctionDeclaration[] = [
  {
    name: 'listRepoTree',
    description: '递归列出指定 GitHub 仓库和分支下的所有文件及其完整路径。此工具旨在辅助获取仓库的完整文件结构，用于深度分析。',
    behavior: Behavior.BLOCKING,
    parameters: {
      type: Type.OBJECT,
      title: 'List GitHub Repository Tree Parameters',
      properties: {
        owner: {
          type: Type.STRING,
          description: 'GitHub 仓库所有者，例如 "SagerNet"。',
          example: 'SagerNet',
        },
        repo: {
          type: Type.STRING,
          description: 'GitHub 仓库名称，例如 "sing-box"。',
          example: 'sing-box',
        },
        branch: {
          type: Type.STRING,
          description: '要查询的仓库分支，默认为仓库默认分支（如 main 或 master）。',
          default: 'main',
          example: 'main',
        },
      },
      required: ['owner', 'repo'],
    },
  },
  {
    name: 'listDirContents',
    description: '列出指定 GitHub 仓库、指定目录内的所有文件和子目录（只包含顶层内容）。此工具旨在辅助探索仓库指定目录的文件结构。',
    behavior: Behavior.BLOCKING,
    parameters: {
      type: Type.OBJECT,
      title: 'List GitHub Directory Contents Parameters',
      properties: {
        owner: {
          type: Type.STRING,
          description: 'GitHub 仓库所有者，例如 "SagerNet"。',
          example: 'SagerNet',
        },
        repo: {
          type: Type.STRING,
          description: 'GitHub 仓库名称，例如 "sing-box"。',
          example: 'sing-box',
        },
        path: {
          type: Type.STRING,
          description: '要列出文件和子目录的路径，默认为仓库根目录。例如 "docs/configuration/"。此路径应相对于仓库根目录。',
          default: '',
          example: 'docs/configuration/',
        },
        branch: {
          type: Type.STRING,
          description: '要查询的仓库分支，默认为仓库默认分支（如 main 或 master）。',
          default: 'main',
          example: 'main',
        },
      },
      required: ['owner', 'repo'],
    },
  },
  {
    name: 'listRepoCommits',
    description: '获取指定 GitHub 仓库的最近指定次数的提交记录。',
    behavior: Behavior.BLOCKING,
    parameters: {
      type: Type.OBJECT,
      title: 'List GitHub Repository Commits Parameters',
      properties: {
        owner: {
          type: Type.STRING,
          description: 'GitHub 仓库所有者，例如 "SagerNet"。',
          example: 'SagerNet',
        },
        repo: {
          type: Type.STRING,
          description: 'GitHub 仓库名称，例如 "sing-box"。',
          example: 'sing-box',
        },
        per_page: {
          type: Type.NUMBER,
          description: '每页返回的提交数量，默认为 20，最大 100。',
          default: 20,
          minimum: 1,
          maximum: 100,
          example: 20,
        },
        page: {
          type: Type.NUMBER,
          description: '页码，默认为 1。',
          default: 1,
          minimum: 1,
          example: 1,
        },
      },
      required: ['owner', 'repo'],
    },
  },
  {
    name: 'listRepoReleases',
    description: '获取指定 GitHub 仓库的最近指定数量的发布版本。',
    behavior: Behavior.BLOCKING,
    parameters: {
      type: Type.OBJECT,
      title: 'Get GitHub Repository Releases Parameters',
      properties: {
        owner: {
          type: Type.STRING,
          description: 'GitHub 仓库所有者，例如 "SagerNet"。',
          example: 'SagerNet',
        },
        repo: {
          type: Type.STRING,
          description: 'GitHub 仓库名称，例如 "sing-box"。',
          example: 'sing-box',
        },
        per_page: {
          type: Type.NUMBER,
          description: '每页返回的发布版本数量，默认为 10，最大 100。',
          default: 10,
          minimum: 1,
          maximum: 100,
          example: 10,
        },
        page: {
          type: Type.NUMBER,
          description: '页码，默认为 1。',
          default: 1,
          minimum: 1,
          example: 1,
        },
      },
      required: ['owner', 'repo'],
    },
  },
  {
    name: 'listRepoBranches',
    description: '列出指定 GitHub 仓库的所有分支。',
    behavior: Behavior.BLOCKING,
    parameters: {
      type: Type.OBJECT,
      title: 'List GitHub Repository Branches Parameters',
      properties: {
        owner: {
          type: Type.STRING,
          description: 'GitHub 仓库所有者，例如 "SagerNet"。',
          example: 'SagerNet',
        },
        repo: {
          type: Type.STRING,
          description: 'GitHub 仓库名称，例如 "sing-box"。',
          example: 'sing-box',
        },
      },
      required: ['owner', 'repo'],
    },
  },
];

const functionForGet: FunctionDeclaration[] = [
  {
    name: 'getFileContents',
    description: '根据提供的 GitHub 仓库文件路径列表，获取文件的原始内容。',
    behavior: Behavior.BLOCKING,
    parameters: {
      type: Type.OBJECT,
      title: 'Get Files Content Parameters',
      properties: {
        filePaths: {
          type: Type.ARRAY,
          description:
            '需要查询的文件路径列表，例如 ["MetaCubeX/Meta-docs/refs/heads/main/docs/api/index.md", "SagerNet/sing-box/refs/heads/dev-next/src/main.go", ...]，每次查询最少 4 个文件 ',
          items: {
            type: Type.STRING,
            title: 'File Path Item',
            description: '单个文件的完整路径，格式为 "owner/repo/refs/heads/branch/path/to/file.ext"',
            example: 'MetaCubeX/Meta-docs/refs/heads/main/docs/api/index.md',
          },
          minItems: '4',
          example: ['MetaCubeX/Meta-docs/refs/heads/main/docs/api/index.md', 'SagerNet/sing-box/refs/heads/dev-next/src/main.go'],
        },
      },
      required: ['filePaths'],
    },
  },
  {
    name: 'getCommitDetails',
    description: '获取指定 GitHub 仓库中某个提交的详细信息。',
    behavior: Behavior.BLOCKING,
    parameters: {
      type: Type.OBJECT,
      title: 'Get GitHub Commit Details Parameters',
      properties: {
        owner: {
          type: Type.STRING,
          description: 'GitHub 仓库所有者，例如 "SagerNet"。',
          example: 'SagerNet',
        },
        repo: {
          type: Type.STRING,
          description: 'GitHub 仓库名称，例如 "sing-box"。',
          example: 'sing-box',
        },
        commit_sha: {
          type: Type.STRING,
          description: '要查询的提交的 SHA 值，例如 "2464ced48c504eb0dee616c6d474813621779afc"。',
          example: '2464ced48c504eb0dee616c6d474813621779afc',
        },
      },
      required: ['owner', 'repo', 'commit_sha'],
    },
  },
  {
    name: 'getIssueComments',
    description: '获取指定 GitHub 仓库中某个 Issue 的所有评论。',
    behavior: Behavior.BLOCKING,
    parameters: {
      type: Type.OBJECT,
      title: 'Get GitHub Issue Comments Parameters',
      properties: {
        owner: {
          type: Type.STRING,
          description: 'GitHub 仓库所有者，例如 "SagerNet"。',
          example: 'SagerNet',
        },
        repo: {
          type: Type.STRING,
          description: 'GitHub 仓库名称，例如 "sing-box"。',
          example: 'sing-box',
        },
        issue_number: {
          type: Type.NUMBER,
          description: 'Issue 的编号，例如 3202。',
          example: 3202,
        },
      },
      required: ['owner', 'repo', 'issue_number'],
    },
  },
  {
    name: 'getReleaseDetails',
    description: '获取指定 GitHub 仓库中某个发布版本的详细信息，包括所有资产。',
    behavior: Behavior.BLOCKING,
    parameters: {
      type: Type.OBJECT,
      title: 'Get GitHub Release Details Parameters',
      properties: {
        owner: {
          type: Type.STRING,
          description: 'GitHub 仓库所有者，例如 "GUI-for-Cores"。',
          example: 'GUI-for-Cores',
        },
        repo: {
          type: Type.STRING,
          description: 'GitHub 仓库名称，例如 "GUI.for.SingBox"。',
          example: 'GUI.for.SingBox',
        },
        release_id: {
          type: Type.NUMBER,
          description: '发布版本的 ID，例如 227541695。如果提供，将优先使用此 ID。',
          example: 227541695,
          nullable: true,
        },
        tag_name: {
          type: Type.STRING,
          description: '发布版本的标签名称，例如 "rolling-release-alpha"。如果未提供 release_id 或其查询失败，将尝试使用此标签名称。',
          example: 'rolling-release-alpha',
          nullable: true,
        },
      },
      required: ['owner', 'repo'],
    },
  },
  {
    name: 'getCurrentTime',
    description: '获取当前 UTC+8 时间并格式化字符串。',
    behavior: Behavior.BLOCKING,
  },
];

const functionForSend: FunctionDeclaration[] = [
  {
    name: 'sendPhotoMessage',
    description: '使用此工具生成图片并向用户发送图片消息。',
    behavior: Behavior.BLOCKING,
    parameters: {
      type: Type.OBJECT,
      title: 'Generate Image Parameters',
      properties: {
        prompt: {
          type: Type.STRING,
          title: 'Image Generation Prompt',
          description: '用于生成图片的文本提示。例如：A cute cat is napping in the sun.',
          example: 'A cute cat is napping in the sun.',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'sendVoiceMessage',
    description: '使用此工具生成语音并向用户发送语音消息。',
    behavior: Behavior.BLOCKING,
    parameters: {
      type: Type.OBJECT,
      title: 'Generate Voice Parameters',
      properties: {
        prompt: {
          type: Type.STRING,
          title: 'Speech Generation Prompt',
          description: '用于生成语音的文本提示。例如：Please say in a helpless tone: 拜托！我不会算命啊！',
          example: 'Please say in a helpless tone: 拜托！我不会算命啊！',
        },
      },
      required: ['prompt'],
    },
  },
];

export const geminiTools: Tool[] = [
  {
    functionDeclarations: [...functionForSearch, ...functionForList, ...functionForGet, ...functionForSend],
  },
];
