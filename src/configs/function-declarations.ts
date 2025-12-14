// src/configs/function-declarations.ts

import { Type, type FunctionDeclaration } from '@google/genai';

export const functionDeclarations = [
  {
    name: 'use_file_search',
    description:
      '使用此工具可以调用 Google Gemini 提供的内置文件搜索工具，对指定的文件存储区进行检索，可以联合检索多个文件存储区。' +
      '（例如：同时检索 GUI.for.Singbox 和 sing-box 的文档，了解某个配置选项的具体含义）',
    parameters: {
      type: Type.OBJECT,
      properties: {
        prompt: {
          type: Type.STRING,
          description: '用自然语言描述要执行的操作。（例如：请帮我查询 sing-box 的 tls 字段的配置结构）',
        },
        fileStores: {
          type: Type.ARRAY,
          description: '要检索的文件存储区列表。',
          items: {
            type: Type.STRING,
            description: '文件存储区的名称。',
            enum: [
              'documents/gui-for-cores',
              'documents/sing-box',
              'documents/mihomo',
              'documents/hysteria2',
              'documents/anytls',
              'sourcecode/gui-for-singbox',
              'sourcecode/gui-for-clash',
              'sourcecode/plugin-hub',
            ],
            minItems: '1',
          },
        },
      },
      required: ['prompt', 'fileStores'],
    },
  },
  {
    name: 'use_github_toolset',
    description:
      '使用此工具可以调用 Github 提供的工具集，对 GitHub 平台进行操作，' +
      '支持几乎所有的 Github REST API 操作。（例如：查询 xxx 仓库的提交记录、获取发布详情等）',
    parameters: {
      type: Type.OBJECT,
      properties: {
        prompt: {
          type: Type.STRING,
          description: '用自然语言描述要执行的操作。（例如：请帮我查询 GUI.for.SingBox 仓库中关于插件功能的源码）',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'use_built-in_tools',
    description:
      '使用此工具可以调用 Google Gemini 提供的内置工具，支持 Google 搜索（实时联网查询）、' +
      '代码执行（通过 Python 代码进行复杂计算）、URL 上下文（访问网页的内容），可以搭配使用多个工具。' +
      '（例如：同时使用 URL 上下文和 Google 搜索，可以通过搜索功能在线查找相关信息，然后使用 URL 上下文工具更深入地了解找到的网页）',
    parameters: {
      type: Type.OBJECT,
      properties: {
        prompt: {
          type: Type.STRING,
          description: '用自然语言描述要执行的操作。（例如：请帮我查询和 sing-box 相关的博客。）',
        },
        tools: {
          type: Type.ARRAY,
          description: '要使用的工具列表。',
          items: {
            type: Type.STRING,
            description: '工具的名称。',
            enum: ['googleSearch', 'codeExecution', 'urlContext'],
            minItems: '1',
          },
        },
      },
      required: ['prompt', 'tools'],
    },
  },
  { name: 'reload_prompts', description: '使用此工具重新加载对话系统的所有系统指令，将在下次对话时生效。' },
] as const satisfies FunctionDeclaration[];
