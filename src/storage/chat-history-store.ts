import type { Content } from '@google/genai';
import { logger } from '@shared/core/logger.js';
import type { ChitchatState } from '@shared/types/telegram.js';
import { ms } from '@shared/utils/helpers.js';
import type { Redis } from '@upstash/redis';

const HISTORY_TTL_DAY = 7;
const MAX_HISTORY_LENGTH = 10;

export class ChatHistoryStore {
  // Convert milliseconds to seconds for Redis EX parameter
  private readonly expirationTtlSeconds = Math.floor(ms.day(HISTORY_TTL_DAY) / 1000);

  constructor(private readonly redisClient: Redis) {
    logger.info('[ChatHistory] Upstash Redis initialized. TTL delegation active.');
  }

  public async get(chatId: number, userId: number): Promise<Content[]> {
    const key = this.generateUserKey(chatId, userId);
    const data = await this.redisClient.get<Content[]>(key);
    return data ?? [];
  }

  public async update(chatId: number, userId: number, contents: Content[]): Promise<void> {
    const key = this.generateUserKey(chatId, userId);
    const history: Content[] = [...contents];
    const excess = history.length - MAX_HISTORY_LENGTH;

    if (excess > 0) {
      history.splice(0, excess);
    }

    // Set value with Expiration time (TTL) managed directly by Redis
    await this.redisClient.set(key, history, { ex: this.expirationTtlSeconds });
    logger.info(`${key}: History persisted, length: ${history.length}`);
  }

  public async clear(chatId: number, userId: number): Promise<void> {
    const key = this.generateUserKey(chatId, userId);
    await this.redisClient.del(key);
    logger.info(`${key}: History cleared.`);
  }

  public getGroupState(chatId: number): Promise<ChitchatState | null> {
    const key = this.generateGroupKey(chatId);
    return this.redisClient.get<ChitchatState>(key);
  }

  public async saveGroupState(chatId: number, state: ChitchatState): Promise<void> {
    const key = this.generateGroupKey(chatId);
    await this.redisClient.set(key, state, { ex: this.expirationTtlSeconds });
  }

  private generateUserKey(chatId: number, userId: number): string {
    return `history:user:${chatId}:${userId}`;
  }

  private generateGroupKey(chatId: number): string {
    return `history:group:${chatId}`;
  }
}
