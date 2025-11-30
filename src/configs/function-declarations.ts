// src/configs/gemini_tools.ts

import { Type, type FunctionDeclaration } from '@google/genai';

export const functionDeclarations: FunctionDeclaration[] = [
  {
    name: 'use_rag_system',
    description: '使用此工具可以对 RAG 系统进行操作，支持查询、导入和删除文档，还可以检查系统状态。',
    parameters: {
      type: Type.OBJECT,
      properties: {
        prompt: {
          type: Type.STRING,
          description: '用自然语言描述要执行的操作。（例如：请帮我查询 sing-box 的 TUN 入站的相关文档）',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'use_github_toolset',
    description:
      '使用此工具可以调用 Github 提供的工具集，对 GitHub 平台进行操作，支持几乎所有 Github REST API 操作。（例如：查询 xxx 仓库的提交记录、获取发布详情等）',
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
    name: 'use_native_tools',
    description:
      '使用此工具可以调用 Google Gemini 提供的原生工具，支持 Google 搜索（实时联网查询）、代码执行（执行任意 Python 代码）、URL 上下文（获取 URL 的内容）。',
    parameters: {
      type: Type.OBJECT,
      properties: {
        prompt: {
          type: Type.STRING,
          description: '用自然语言描述要执行的操作。（例如：请帮我查询介绍 sing-box 的博客。）',
        },
      },
      required: ['prompt'],
    },
  },
  { name: 'reload_prompts', description: '使用此工具重新加载对话系统的所有系统指令，将在下次对话时生效。' },
];
