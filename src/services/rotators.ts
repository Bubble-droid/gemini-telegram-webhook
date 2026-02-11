import { CONFIG } from '@shared/core/config.js';
import { GEMINI_MODELS } from '@shared/core/constants.js';
import { ListRotator } from './list-rotator.js';

export const keyRotator = new ListRotator(CONFIG.GEMINI_API_KEYS);
export const modelRotator = new ListRotator(GEMINI_MODELS);
