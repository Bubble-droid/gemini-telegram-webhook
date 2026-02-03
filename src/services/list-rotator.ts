import { DataError } from '@shared/core/errors';
import { logger } from '@shared/core/logger';

export class ListRotator {
  private readonly items: Set<string>;
  private currentIterator: SetIterator<string>;

  constructor(list: string[]) {
    if (list.length === 0) {
      throw new DataError('Cannot initialize ListRotator with an empty list.');
    }
    this.items = new Set(list);
    this.currentIterator = this.items.values();
    logger.info(`Creating ListRotator instance, loaded ${this.items.size} values.`);
  }

  /**
   * Retrieves the next item in the rotation.
   * If the iterator reaches the end, it resets to the beginning.
   */
  public next(): string {
    // Attempt to retrieve the next value from the current iterator
    let result: IteratorResult<string, undefined> = this.currentIterator.next();

    // If the iterator is exhausted (done: true), we must reset it
    if (result.done) {
      // Create a fresh iterator starting from the beginning
      this.currentIterator = this.items.values();
      // Immediately fetch the first item from the new iterator
      result = this.currentIterator.next();
    }

    // Strict type guard: Value should not be undefined if list is non-empty
    if (result.value === undefined) {
      throw new DataError('Unexpected state: No value available in ListRotator.');
    }

    return result.value;
  }

  public getSize(): number {
    return this.items.size;
  }
}
