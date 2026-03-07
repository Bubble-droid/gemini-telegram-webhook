import { logger } from '@shared/core/logger.js';
import { formatTime } from '@shared/utils/helpers.js';
import type { Redis } from '@upstash/redis';

const MEMORY_PREFIX = 'memory:';

export class LongTermMemoryStore {
  constructor(private readonly redisClient: Redis) {
    logger.info('[LongTermMemory] Upstash Redis initialized, memory connected.');
  }

  /**
   * 1. Add User Memory
   * Appends a new memory string to the specific user's Redis List.
   */
  public async addMemory(userId: number, content: string): Promise<string> {
    if (!content.trim().length) {
      const emptyMsg = `Attempted to add empty memory for ${userId}`;
      logger.warn(`[LongTermMemory] ${emptyMsg}`);
      return emptyMsg;
    }

    const memoryId = this.generateMemoryId(userId);
    const formattedContent = `${content} (Added on ${formatTime(Date.now())})`;

    // RPUSH appends to the Redis List
    await this.redisClient.rpush(memoryId, formattedContent);
    const totalLength = await this.redisClient.llen(memoryId);

    const addedMsg = `Added memory for ${userId}: ${content}. Total: ${totalLength}`;
    logger.info(`[LongTermMemory] ${addedMsg}`);
    return addedMsg;
  }

  /**
   * 2. List User Memories
   * Retrieves all stored memories for a specific user from Redis.
   */
  public async getMemories(userId: number): Promise<string> {
    const memoryId = this.generateMemoryId(userId);
    const userMemories = await this.redisClient.lrange(memoryId, 0, -1);

    if (userMemories.length === 0) {
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
   */
  public async removeMemory(userId: number, index: number): Promise<string> {
    const memoryId = this.generateMemoryId(userId);
    const userMemories = await this.redisClient.lrange(memoryId, 0, -1);

    if (userMemories.length === 0) {
      const cannotMsg = `Cannot delete memory: User ${userId} not found.`;
      logger.warn(`[LongTermMemory] ${cannotMsg}`);
      return cannotMsg;
    }

    if (index < 0 || index >= userMemories.length) {
      const invalidMsg = `Invalid deletion index ${index} for user ${userId}.`;
      logger.warn(`[LongTermMemory] ${invalidMsg}`);
      return invalidMsg;
    }

    const removedItem = userMemories.splice(index, 1);

    // Atomically replace the entire list using a pipeline
    const pipeline = this.redisClient.pipeline();
    pipeline.del(memoryId);
    if (userMemories.length > 0) {
      pipeline.rpush(memoryId, ...userMemories);
    }
    await pipeline.exec();

    const removedMsg = `Removed memory at index ${index} for ${userId}: "${removedItem[0]}"`;
    logger.info(`[LongTermMemory] ${removedMsg}`);
    return removedMsg;
  }

  private generateMemoryId(userId: number) {
    return `${MEMORY_PREFIX}_${userId}`;
  }
}
