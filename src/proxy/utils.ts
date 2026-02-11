import type { GenerateContentResponse } from '@google/genai';
import { CLI_VERSION, GEMINI_BASE_URL } from '@shared/core/constants.js';
import os from 'os';
import type { GeminiApiRequest, GoogleApiRequest } from './types.js';

export const getUserAgent = (): string => {
  const system = os.type().toLowerCase();
  const arch = os.arch().toLowerCase();
  return `GeminiCLI/${CLI_VERSION}/gemini-2.5-pro (${system}; ${arch})`;
};

const getPlatformString = (): string => {
  const system = os.type().toUpperCase();
  const arch = os.arch().toUpperCase();

  if (system === 'DARWIN') {
    return arch.includes('ARM64') || arch.includes('AARCH64') ? 'DARWIN_ARM64' : 'DARWIN_AMD64';
  }
  if (system === 'LINUX') {
    return arch.includes('ARM64') || arch.includes('AARCH64') ? 'LINUX_ARM64' : 'LINUX_AMD64';
  }
  if (system === 'WINDOWS_NT') {
    return 'WINDOWS_AMD64';
  }
  return 'PLATFORM_UNSPECIFIED';
};

export const getClientMetadata = (projectId?: string | null) => {
  return {
    ideType: 'IDE_UNSPECIFIED',
    platform: getPlatformString(),
    pluginType: 'GEMINI',
    duetProject: projectId,
  };
};

export const convertToGoogleApiRequest = (
  geminiRequest: GeminiApiRequest,
  modelFromPath: string,
  projectId: string,
): GoogleApiRequest => {
  return {
    model: modelFromPath,
    project: projectId,
    request: geminiRequest,
  };
};

export const isValidGeminiResponse = (response: GenerateContentResponse): boolean => {
  return (
    !!response.candidates?.[0]?.content?.parts?.some((p) => (p.text ?? '').trim().length > 0) ||
    !!response.candidates?.[0]?.content?.parts?.some((p) => p.functionCall)
  );
};

export const getGeminiGenerateContentEndpoint = (model: string) => {
  return `${GEMINI_BASE_URL}/v1beta/models/${model}:generateContent`;
};
