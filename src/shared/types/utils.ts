/**
 * 获取 T 中所有可选属性的键名
 */
export type OptionalKeys<T> = {
  [K in keyof T]-?: object extends Pick<T, K> ? K : never;
}[keyof T];

/**
 * 提取 T 中的可选属性，并将其转为必选
 */
export type ExtractAndMakeRequired<T> = {
  [K in OptionalKeys<T>]-?: T[K];
};

export type Evaluate<T> = T extends object ? (T extends infer O ? { [K in keyof O]: Evaluate<O[K]> } : never) : T;

export type ExtractMethods<T> = {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  [K in keyof T]: T[K] extends Function ? K : never;
}[keyof T];

export type StringifyProps<T> = {
  [K in keyof T]: string;
};

export type RequiredKeys<T> = {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

export type VerifyExactKeys<K, U extends readonly unknown[]> = [K] extends [U[number]]
  ? [U[number]] extends [K]
    ? U
    : '❌ Missing required properties'
  : '❌ Properties do not match';
