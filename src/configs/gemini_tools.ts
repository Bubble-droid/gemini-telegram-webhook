// src/configs/gemini_tools.ts

import type { FunctionDeclaration, Tool } from '@google/genai';
import { Type, Behavior } from '@google/genai';

const functionForSearch: FunctionDeclaration[] = [
  {
    name: 'searchFilesInRepo',
    description: '根据关键词在指定的 GitHub 仓库搜索文件，以获取相关文件路径。',
    behavior: Behavior.BLOCKING,
    parameters: {
      type: Type.OBJECT,
      title: 'Search GitHub Repository Files By Keyword Parameters',
      properties: {
        keyword: {
          type: Type.STRING,
          description: '用于搜索文件内容的关键词，多个关键词请用 AND 或 OR 分隔，例如 "route AND reject"。',
        },
        owner: {
          type: Type.STRING,
          description: 'GitHub 仓库所有者，例如 "SagerNet"。',
        },
        repo: {
          type: Type.STRING,
          description: 'GitHub 仓库名称，例如 "sing-box"。',
        },
        branch: {
          type: Type.STRING,
          description: '要搜索的仓库分支，默认为仓库默认分支（如 main 或 master）。',
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
          description: '用于搜索提交消息内容的关键词。',
        },
        owner: {
          type: Type.STRING,
          description: 'GitHub 仓库所有者，例如 "SagerNet"。',
        },
        repo: {
          type: Type.STRING,
          description: 'GitHub 仓库名称，例如 "sing-box"。',
        },
      },
      required: ['keyword', 'owner', 'repo'],
    },
  },
  {
    name: 'searchIssuesInRepo',
    description: '根据关键词在指定的 GitHub 仓库内搜索 Issue 或 Pull Request，并可根据状态返回匹配的 Issue 列表。',
    behavior: Behavior.BLOCKING,
    parameters: {
      type: Type.OBJECT,
      title: 'Search GitHub Issues Parameters',
      properties: {
        keyword: {
          type: Type.STRING,
          description: '用于搜索 Issue 内容和标题的关键词。',
        },
        owner: {
          type: Type.STRING,
          description: 'GitHub 仓库所有者，例如 "SagerNet"。',
        },
        repo: {
          type: Type.STRING,
          description: 'GitHub 仓库名称，例如 "sing-box"。',
        },
        type: {
          type: Type.STRING,
          description: 'Issue 或 Pull Request 的类型，可以是 "issue" 或 "pr"，默认为 "issue"。',
          default: 'issue',
          enum: ['issue', 'pr'],
        },
        state: {
          type: Type.STRING,
          description: 'Issue 的状态，可以是 "open"、"closed"，默认为 "open"。',
          default: 'open',
          enum: ['open', 'closed'],
        },
      },
      required: ['keyword', 'owner', 'repo', 'type'],
    },
  },
  {
    name: 'searchReposInGlobal',
    description: '根据关键词在整个 GitHub 平台搜索相关的公开仓库。',
    behavior: Behavior.BLOCKING,
    parameters: {
      type: Type.OBJECT,
      title: 'Search GitHub Repositories Globally Parameters',
      properties: {
        keyword: {
          type: Type.STRING,
          description: '用于搜索仓库名称和描述的关键词，例如 "sing-box dashboard"。',
        },
        qualifier: {
          type: Type.STRING,
          description:
            '搜索范围，可以是 "name"（仓库名称）、"description"（仓库描述）、"readme"（README 文件内容）。多个值用逗号分隔，例如 "name,description"。',
          default: 'name,description,readme',
          enum: ['name', 'description', 'readme'],
        },
      },
      required: ['keyword'],
    },
  },
  {
    name: 'searchIssuesInGlobal',
    description: '根据关键词在整个 GitHub 平台搜索相关的公开 Issue。',
    behavior: Behavior.BLOCKING,
    parameters: {
      type: Type.OBJECT,
      title: 'Search GitHub Issues Globally Parameters',
      properties: {
        keyword: {
          type: Type.STRING,
          description: '用于搜索 Issue 内容和标题的关键词。',
        },
        state: {
          type: Type.STRING,
          description: 'Issue 的状态，可以是 "open"、"closed"，默认为 "open"。',
          default: 'open',
          enum: ['open', 'closed'],
        },
      },
      required: ['keyword'],
    },
  },
];

const functionForList: FunctionDeclaration[] = [
  {
    name: 'listRepoTree',
    description: '递归列出指定 GitHub 仓库和分支下的所有文件及其完整路径。',
    behavior: Behavior.BLOCKING,
    parameters: {
      type: Type.OBJECT,
      title: 'List GitHub Repository Tree Parameters',
      properties: {
        owner: {
          type: Type.STRING,
          description: 'GitHub 仓库所有者，例如 "SagerNet"。',
        },
        repo: {
          type: Type.STRING,
          description: 'GitHub 仓库名称，例如 "sing-box"。',
        },
        branch: {
          type: Type.STRING,
          description: '要查询的仓库分支，默认为仓库默认分支（如 main 或 master）。',
        },
      },
      required: ['owner', 'repo', 'branch'],
    },
  },
  {
    name: 'listDirContents',
    description: '列出指定 GitHub 仓库、指定目录内的所有文件和子目录（只包含顶层内容）。',
    behavior: Behavior.BLOCKING,
    parameters: {
      type: Type.OBJECT,
      title: 'List GitHub Directory Contents Parameters',
      properties: {
        owner: {
          type: Type.STRING,
          description: 'GitHub 仓库所有者，例如 "SagerNet"。',
        },
        repo: {
          type: Type.STRING,
          description: 'GitHub 仓库名称，例如 "sing-box"。',
        },
        path: {
          type: Type.STRING,
          description: '要列出文件和子目录的路径，默认为仓库根目录。例如 "docs/configuration/"。此路径应相对于仓库根目录。',
          default: '',
        },
        branch: {
          type: Type.STRING,
          description: '要查询的仓库分支，默认为仓库默认分支（如 main 或 master）。',
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
        },
        repo: {
          type: Type.STRING,
          description: 'GitHub 仓库名称，例如 "sing-box"。',
        },
        per_page: {
          type: Type.NUMBER,
          description: '每页返回的提交数量，默认为 20，最大 100。',
          default: 20,
          minimum: 1,
          maximum: 100,
        },
      },
      required: ['owner', 'repo', 'per_page'],
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
        },
        repo: {
          type: Type.STRING,
          description: 'GitHub 仓库名称，例如 "sing-box"。',
        },
        per_page: {
          type: Type.NUMBER,
          description: '每页返回的发布版本数量，默认为 10，最大 100。',
          default: 10,
          minimum: 1,
          maximum: 100,
        },
      },
      required: ['owner', 'repo', 'per_page'],
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
        },
        repo: {
          type: Type.STRING,
          description: 'GitHub 仓库名称，例如 "sing-box"。',
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
            '需要查询的文件路径列表，每次最少查询 4 个文件，例如：["MetaCubeX/Meta-docs/refs/heads/main/docs/api/index.md", "SagerNet/sing-box/refs/heads/dev-next/src/main.go"]',
          items: {
            type: Type.STRING,
            title: 'File Path Item',
            description: '单个文件的完整路径，格式为 "owner/repo/refs/heads/branch/path/to/file.ext"',
          },
          minItems: '4',
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
        },
        repo: {
          type: Type.STRING,
          description: 'GitHub 仓库名称，例如 "sing-box"。',
        },
        commit_sha: {
          type: Type.STRING,
          description: '要查询的提交的 SHA 值，例如 "2464ced48c504eb0dee616c6d474813621779afc"。',
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
        },
        repo: {
          type: Type.STRING,
          description: 'GitHub 仓库名称，例如 "sing-box"。',
        },
        issue_number: {
          type: Type.NUMBER,
          description: 'Issue 的编号，例如 3202。',
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
        },
        repo: {
          type: Type.STRING,
          description: 'GitHub 仓库名称，例如 "GUI.for.SingBox"。',
        },
        release_id: {
          type: Type.NUMBER,
          description: '发布版本的 ID，例如 227541695。',
        },
      },
      required: ['owner', 'repo', 'release_id'],
    },
  },
  {
    name: 'getCurrentTime',
    description: '获取当前 UTC+8 时间并格式化字符串。',
    behavior: Behavior.BLOCKING,
  },
  {
    name: 'getFileAndUpload',
    description: '从指定链接下载文件并上传给用户。',
    behavior: Behavior.BLOCKING,
    parameters: {
      type: Type.OBJECT,
      title: 'Get File And Upload Parameters',
      properties: {
        fileUrl: {
          type: Type.STRING,
          description: '文件下载链接',
        },
      },
      required: ['fileUrl'],
    },
  },
];

const functionForGenerate: FunctionDeclaration[] = [
  {
    name: 'generateImage',
    description: '使用此工具生成图片并用图片回复用户。',
    behavior: Behavior.BLOCKING,
    parameters: {
      type: Type.OBJECT,
      title: 'Generate Image Parameters',
      properties: {
        prompt: {
          type: Type.STRING,
          title: 'Image Generation Prompt',
          description: `用于生成图片的文本提示。例如：
          A photorealistic [shot type] of [subject], [action or expression], set in
[environment]. The scene is illuminated by [lighting description], creating
a [mood] atmosphere. Captured with a [camera/lens details], emphasizing
[key textures and details]. The image should be in a [aspect ratio] format.

A [style] sticker of a [subject], featuring [key characteristics] and a
[color palette]. The design should have [line style] and [shading style].
The background must be transparent.

A single comic book panel in a [art style] style. In the foreground,
[character description and action]. In the background, [setting details].
The panel has a [dialogue/caption box] with the text "[Text]". The lighting
creates a [mood] mood. [Aspect ratio].

A high-resolution, studio-lit product photograph of a [product description]
on a [background surface/description]. The lighting is a [lighting setup,
e.g., three-point softbox setup] to [lighting purpose]. The camera angle is
a [angle type] to showcase [specific feature]. Ultra-realistic, with sharp
focus on [key detail]. [Aspect ratio].`,
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'generateSpeech',
    description: '使用此工具生成语音并用语音回复用户。',
    behavior: Behavior.BLOCKING,
    parameters: {
      type: Type.OBJECT,
      title: 'Generate Speech Parameters',
      properties: {
        prompt: {
          type: Type.STRING,
          title: 'Speech Generation Prompt',
          description: `用于生成语音的文本提示，可以使用自然语言提示来控制语音的样式、语调、口音和语速。例如：
          Say in a helpless tone:
"拜托！我不会算命啊！"

Say in an spooky whisper:
"By the pricking of my thumbs...
Something wicked this way comes"

Make Speaker1 sound tired and bored, and Speaker2 sound excited and happy:
Speaker1: So... what's on the agenda today?
Speaker2: You're never going to guess!`,
        },
      },
      required: ['prompt'],
    },
  },
];

export const geminiTools: Tool[] = [
  {
    functionDeclarations: [...functionForSearch, ...functionForList, ...functionForGet, ...functionForGenerate],
  },
];
