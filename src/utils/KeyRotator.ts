import { config } from '@/services/ConfigLoader';
import { logger } from '@/services/LoggerService';

class KeyRotator {
  // 存储解析后的 API 密钥列表
  private readonly keys: string[];

  // 当前使用的密钥索引指针
  private currentIndex: number = 0;

  constructor() {
    this.keys = config.geminiApiKeys;
    logger.info(`KeyRotator 初始化完成，共加载 ${this.keys.length} 个密钥。`);
  }

  /**
   * 获取下一个可用的 API Key
   *
   * @description
   * 采用指针轮询算法，无需修改数组结构，性能为 O(1)。
   * 由于数据已在内存中，此方法为同步方法，调用效率极高。
   *
   * @returns {string} API Key
   */
  public nextKey(): string {
    // 获取当前指针指向的密钥
    const currentKey = this.keys[this.currentIndex];

    // 生成密钥 ID (取前 5 位用于日志脱敏展示)
    const keyId = `${currentKey.substring(0, 5)}...${currentKey.substring(currentKey.length - 5)}`;

    // 记录日志 (生产环境建议设为 debug 级别以减少噪音)
    logger.debug(`使用密钥: ${keyId} (Index: ${this.currentIndex})`);

    // 移动指针：实现循环轮换逻辑
    // (0 + 1) % 3 = 1 -> (1 + 1) % 3 = 2 -> (2 + 1) % 3 = 0
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;

    return currentKey;
  }

  /**
   * 获取当前所有已加载的密钥数量
   */
  public getKeyCount(): number {
    return this.keys.length;
  }
}

export const keyRotator = new KeyRotator();
