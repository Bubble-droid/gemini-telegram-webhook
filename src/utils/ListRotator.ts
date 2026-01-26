import { logger } from '@/services';
import { AppError } from './errors';

export class ListRotator {
  private readonly list: string[];
  private currentValue: string | undefined;
  private currentIndex = 0;

  constructor(list: string[]) {
    this.list = list;
    logger.info(`Creating ListRotator instance, loaded ${this.list.length} values.`);
  }

  public next(): string {
    this.currentValue = this.list[this.currentIndex];
    if (!this.currentValue) {
      throw new AppError('No value available.');
    }
    // 移动指针：实现循环轮换逻辑
    // (0 + 1) % 3 = 1 -> (1 + 1) % 3 = 2 -> (2 + 1) % 3 = 0
    this.currentIndex = (this.currentIndex + 1) % this.list.length;

    return this.currentValue;
  }

  public getCount(): number {
    return this.list.length;
  }
}
