import type { Content, GenerateContentConfig, GenerationConfig } from '@google/genai';
import type { TProxyHeaders } from '@routes/route-schema.js';
import type { FastifyRequest } from 'fastify';

export interface GeminiApiRequest {
  contents?: Content[];
  systemInstruction?: GenerateContentConfig['systemInstruction'];
  tools?: GenerateContentConfig['tools'];
  toolConfig?: GenerateContentConfig['toolConfig'];
  safetySettings?: GenerateContentConfig['safetySettings'];
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

export type generateContentRequest = FastifyRequest<{
  Params: { modelAndMethod: string };
  Body: GeminiApiRequest;
  Headers: TProxyHeaders;
}>;
