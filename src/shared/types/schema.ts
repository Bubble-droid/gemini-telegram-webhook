import type { Type } from '@google/genai';
import type { Recordable } from './common';
import type { Evaluate } from './utils';

export type JSONSchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null';
export type JSONSchema =
  | boolean
  | Readonly<{
      $id?: string | undefined;
      $ref?: string | undefined;
      $schema?: string | undefined;
      $comment?: string | undefined;
      type?: JSONSchemaType | readonly JSONSchemaType[];
      const?: unknown;
      enum?: unknown;
      multipleOf?: number | undefined;
      maximum?: number | undefined;
      exclusiveMaximum?: number | undefined;
      minimum?: number | undefined;
      exclusiveMinimum?: number | undefined;
      maxLength?: number | undefined;
      minLength?: number | undefined;
      pattern?: string | undefined;
      items?: JSONSchema | readonly JSONSchema[];
      additionalItems?: JSONSchema;
      contains?: JSONSchema;
      maxItems?: number | undefined;
      minItems?: number | undefined;
      uniqueItems?: boolean | undefined;
      maxProperties?: number | undefined;
      minProperties?: number | undefined;
      required?: readonly string[];
      properties?: Readonly<Recordable<JSONSchema>>;
      patternProperties?: Readonly<Recordable<JSONSchema>>;
      additionalProperties?: JSONSchema;
      unevaluatedProperties?: JSONSchema;
      dependencies?: Readonly<Recordable<JSONSchema | readonly string[]>>;
      propertyNames?: JSONSchema;
      if?: JSONSchema;
      then?: JSONSchema;
      else?: JSONSchema;
      allOf?: readonly JSONSchema[];
      anyOf?: readonly JSONSchema[];
      oneOf?: readonly JSONSchema[];
      not?: JSONSchema;
      format?: string | undefined;
      contentMediaType?: string | undefined;
      contentEncoding?: string | undefined;
      definitions?: Readonly<Recordable<JSONSchema>>;
      title?: string | undefined;
      description?: string | undefined;
      default?: unknown;
      readOnly?: boolean | undefined;
      writeOnly?: boolean | undefined;
      examples?: readonly unknown[];
      nullable?: boolean;
    }>;

/**
 * 基础类型映射表
 */
interface SchemaTypeMap {
  // Standard JSON Schema Literals
  string: string;
  number: number;
  integer: number;
  boolean: boolean;
  null: null;

  // Google GenAI Enums
  [Type.STRING]: string;
  [Type.NUMBER]: number;
  [Type.INTEGER]: number;
  [Type.BOOLEAN]: boolean;
}

/** 提取必填字段 Keys */
type ExtractRequired<T> = T extends { required: readonly string[] } ? T['required'][number] : never;

// =================================================================
// 3. 核心解析器
// =================================================================

/**
 * 解析 Const (字面量常量)
 */
type ResolveConst<T> = T extends { const: infer C } ? C : never;

/**
 * 解析 Enum (枚举联合)
 */
type ResolveEnum<T> = T extends { enum: readonly (infer E)[] } ? E : never;

/**
 * 解析 Array
 * 兼容 type: 'array' 和 type: Type.ARRAY
 */
type ResolveArray<T> = T extends { items: infer I } ? InferSchema<I>[] : unknown[];

/**
 * 解析 additionalProperties (索引签名)
 * 如果没有定义 additionalProperties，默认为 unknown (标准行为) 还是空?
 *
 * 策略：
 * 1. true -> Record<string, unknown>
 * 2. Schema -> Record<string, Infer<Schema>>
 * 3. false/undefined -> unknown (为了兼容性，不强制添加索引签名，除非显式声明 true)
 */
type ResolveAdditional<T> = T extends { additionalProperties: infer AP }
  ? AP extends true
    ? Recordable
    : AP extends object // AP 是 Schema 对象
      ? Recordable<InferSchema<AP>>
      : unknown
  : unknown; // 默认不添加索引签名，保持严格

/**
 * 解析 Object Properties
 */
type ResolveProperties<T> = T extends { properties: infer P }
  ? P extends Recordable
    ? Evaluate<
        {
          // 必填字段
          [K in keyof P as K extends ExtractRequired<T> ? K : never]: InferSchema<P[K]>;
        } & {
          // 可选字段
          [K in keyof P as K extends ExtractRequired<T> ? never : K]?: InferSchema<P[K]>;
        }
      >
    : unknown
  : unknown;

/**
 * 解析 Object 结构
 * 组合 Properties 和 AdditionalProperties
 */
type ResolveObject<T> = Evaluate<ResolveProperties<T> & ResolveAdditional<T>>;

/**
 * 解析基础类型 (Primitive)
 */
type ResolvePrimitive<T> = T extends { type: infer TType }
  ? TType extends keyof SchemaTypeMap
    ? SchemaTypeMap[TType]
    : unknown
  : unknown;

// =================================================================
// 4. 主推断入口 (统一入口)
// =================================================================

export type InferSchema<T> =
  // 1. Const (最高优先级)
  T extends { const: unknown }
    ? ResolveConst<T>
    : // 2. Enum
      T extends { enum: readonly unknown[] }
      ? ResolveEnum<T>
      : // 3. Array (兼容两种 type 定义)
        T extends { type: 'array' | Type.ARRAY }
        ? ResolveArray<T>
        : // 4. Object (兼容两种 type 定义，或隐式 properties)
          T extends { type: 'object' | Type.OBJECT } | { properties: unknown }
          ? ResolveObject<T>
          : // 5. Primitive (查表)
            ResolvePrimitive<T>;
