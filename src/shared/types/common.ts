export type Recordable<T = unknown> = Record<string, T>;

export type MaybePromise<T> = T | Promise<T>;
