// src/script/index.ts

import { ExecutionService } from './execution';
import { ScriptManager } from './manager';
import { StorageService } from './storage';

export const scriptManager: ScriptManager = new ScriptManager();
export const executionService: ExecutionService = new ExecutionService();
export const storageService: StorageService = new StorageService();
