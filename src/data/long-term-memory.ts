import { DATA_DIR, LONG_TERM_MEMORY_FILE } from '@shared/core/constants.js';
import { logger } from '@shared/core/logger.js';
import { formatTime } from '@shared/utils/helpers.js';
import type { LowSync } from 'lowdb';
import path from 'node:path';
import { loadLowdb } from './data-load.js';

type TgUserId = `tg_${string}`;

interface DatabaseSchema {
  memories: Record<TgUserId, string[]>;
}

const MEMORIES_FILE_PATH = path.join(DATA_DIR, LONG_TERM_MEMORY_FILE);
const DEFAULT_MEMORY_DATA: DatabaseSchema = { memories: {} };

class LongTermMemory {
  private db: LowSync<DatabaseSchema>;

  constructor() {
    this.db = loadLowdb<DatabaseSchema>(MEMORIES_FILE_PATH, DEFAULT_MEMORY_DATA);
    logger.info('[LongTermMemory] LowDB initialized, memory loaded.');
  }

  /**
   * 1. Add User Memory
   * Appends a new memory string to the specific user's record.
   */
  public addMemory(userId: number, content: string): string {
    if (!content.trim().length) {
      const emptyMsg = `Attempted to add empty memory for ${userId}`;
      logger.warn(`[LongTermMemory] ${emptyMsg}`);
      return emptyMsg;
    }

    const memoryId = this.generateMemoryId(userId);
    this.db.data.memories[memoryId] ??= [];
    const userMemories = this.db.data.memories[memoryId];

    userMemories.push(`${content} (Added on ${formatTime(Date.now())})`);
    this.db.write();

    const addedMsg = `Added memory for ${userId}: ${content}. Total: ${userMemories.length}`;
    logger.info(`[LongTermMemory] ${addedMsg}`);
    return addedMsg;
  }

  /**
   * 2. List User Memories
   * Retrieves all stored memories for a specific user.
   */
  public getMemories(userId: number): string {
    const memoryId = this.generateMemoryId(userId);
    const userMemories = this.db.data.memories[memoryId];

    if (!userMemories?.length) {
      const cannotMsg = `Cannot retrieve memories: User ${userId} not added any memory.`;
      logger.info(`[LongTermMemory] ${cannotMsg}`);
      return cannotMsg;
    }

    const retrievedMsg = `Retrieved ${userMemories.length} memories for ${userId}.`;
    logger.info(`[LongTermMemory] ${retrievedMsg}`);

    return `${retrievedMsg}\n\n${userMemories.map((m, i) => `${i}. ${m}`).join('\n')}`;
  }

  /**
   * 3. Delete Specific Memory
   * Removes a memory entry by its index.
   * Returns true if successful, false if the index was invalid.
   */
  public removeMemory(userId: number, index: number): string {
    const memoryId = this.generateMemoryId(userId);
    const userMemories = this.db.data.memories[memoryId];

    if (!userMemories?.length) {
      const cannotMsg = `Cannot delete memory: User ${userId} not found.`;
      logger.warn(`[LongTermMemory] ${cannotMsg}`);
      return cannotMsg;
    }

    // Validate index bounds
    if (index < 0 || index >= userMemories.length) {
      const invalidMsg = `Invalid deletion index ${index} for user ${userId}.`;
      logger.warn(`[LongTermMemory] ${invalidMsg}`);
      return invalidMsg;
    }

    // Remove the item at the specified index
    const removedItem = userMemories.splice(index, 1);
    this.db.write();

    const removedMsg = `Removed memory at index ${index} for ${userId}: "${removedItem[0]}"`;
    logger.info(`[LongTermMemory] ${removedMsg}`);
    return removedMsg;
  }

  private generateMemoryId(userId: number): TgUserId {
    return `tg_${userId}`;
  }
}

export const longTermMemory = new LongTermMemory();
