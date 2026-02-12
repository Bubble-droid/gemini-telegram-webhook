import type { Content, GenerateContentConfig, GenerationConfig } from '@google/genai';
import type { TProxyHeaders } from '@routes/route-schema.js';

export interface GeminiApiRequest extends Pick<GenerateContentConfig, 'tools' | 'toolConfig' | 'safetySettings'> {
  contents?: Content[];
  systemInstruction?: Content | string;
  generationConfig?: GenerationConfig;
}

export interface GoogleApiRequest {
  model: string;
  project: string;
  request: GeminiApiRequest;
}

export interface ProjectDiscoveryResponse {
  cloudaicompanionProject?: string;
  allowedTiers:
    | {
        id: string;
        isDefault?: boolean;
      }[]
    | undefined;
}

export interface OnboardUserResponse {
  done?: boolean;
  response?: {
    cloudaicompanionProject?: {
      id: string;
    };
  };
}

export interface GenerateContentRequest {
  Params: { modelAndMethod: string };
  Body: GeminiApiRequest;
  Headers: TProxyHeaders;
}
