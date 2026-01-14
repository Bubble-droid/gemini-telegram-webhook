import type { Content } from '@google/genai';

export interface ChitChatState {
  maxScore: number;
  currentScore: number;
  context: Content[];
}
