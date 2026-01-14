// src/configs/function-declarations.ts

import type { FileStoreName } from '@/types';
import { Type, type FunctionDeclaration } from '@google/genai';

export const FileStores = {
  document: ['gui-for-cores', 'sing-box', 'mihomo', 'hysteria2', 'anytls'],
  sourcecode: ['plugin-hub'],
} as const;

const getFileStoreNames = (): FileStoreName[] => {
  return Object.entries(FileStores).flatMap(([category, items]) =>
    items.map((item) => `${category}/${item}` as FileStoreName),
  );
};

export const functionDeclarations = [
  {
    name: 'use_file_search',
    description:
      'This tool can call the built-in file search tool provided by Google Gemini to search specified file storage areas, allowing for the joint search of multiple file storage areas. (For example: simultaneously search the documentation for GUI.for.Singbox and sing-box to understand the specific meaning of a certain configuration option)',
    parameters: {
      type: Type.OBJECT,
      properties: {
        prompt: {
          type: Type.STRING,
          description:
            'Describe the action you want to perform in natural language. (For example: Please help me query the configuration structure of the tls field in sing-box)',
        },
        fileStores: {
          type: Type.ARRAY,
          description: 'List of file storage areas to be searched.',
          items: {
            type: Type.STRING,
            description: 'Name of the file storage area.',
            enum: getFileStoreNames(),
          },
          minItems: '1',
        },
      },
      required: ['prompt', 'fileStores'],
    },
  },
  {
    name: 'use_github_toolset',
    description:
      'This tool can call the set of tools provided by GitHub to perform operations on the GitHub platform, supporting almost all GitHub REST API operations. (For example: querying commit records for xxx repository, obtaining release details, etc.)',
    parameters: {
      type: Type.OBJECT,
      properties: {
        prompt: {
          type: Type.STRING,
          description:
            'Describe the action you want to perform in natural language. (For example: Please help me find the source code about plugin functions in the GUI.for.SingBox repository.)',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'use_built-in_tools',
    description:
      'This tool can call built-in tools provided by Google Gemini, supporting Google Search (real-time online queries), code execution (complex calculations through Python code), and URL context (accessing the content of web pages). Multiple tools can be used together. (For example: using URL context and Google Search simultaneously allows you to find relevant information online through the search function, then use the URL context tool to gain a deeper understanding of the found web pages)',
    parameters: {
      type: Type.OBJECT,
      properties: {
        prompt: {
          type: Type.STRING,
          description:
            'Describe the action you want to perform in natural language. (For example: Please help me search for blogs related to sing-box.)',
        },
        tools: {
          type: Type.ARRAY,
          description: 'List of tools to use.',
          items: {
            type: Type.STRING,
            description: 'Name of the tool.',
            enum: ['googleSearch', 'codeExecution', 'urlContext'],
          },
          minItems: '1',
        },
      },
      required: ['prompt', 'tools'],
    },
  },
  {
    name: 'reload_prompts',
    description:
      'Using this tool to reload all system instructions for the dialogue system will take effect the next time a dialogue occurs.',
  },
] as const satisfies FunctionDeclaration[];
