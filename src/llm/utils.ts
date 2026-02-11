import type { Content, GenerateContentResponse, Part } from '@google/genai';
import { deepClone } from '@shared/utils/helpers.js';

export const simplifyResponse = (res: GenerateContentResponse): GenerateContentResponse => {
  const copy = deepClone(res);
  copy.candidates?.forEach((c) => {
    simplifyParts(c.content?.parts);
  });
  return copy;
};

export const simplifyContents = (contents: Content[] | undefined): Content[] => {
  if (!contents) return [];
  const copy = deepClone(contents);
  copy.forEach((c) => {
    simplifyParts(c.parts);
  });
  return copy;
};

const simplifyParts = (parts: Part[] | undefined) => {
  if (!parts) return;
  parts.forEach((p) => {
    if (p.thought) p.text = '[THOUGHT_SUMMARIES]';
    if (p.thoughtSignature) p.thoughtSignature = '[THOUGHT_SIGNATURE]';
    if (p.inlineData?.data) p.inlineData.data = '[BASE64_DATA]';
  });
};
