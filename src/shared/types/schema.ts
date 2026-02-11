import type { Type } from '@google/genai';
import type { Recordable } from './common.js';
import type { Evaluate } from './utils.js';

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

/** Extract Required Keys */
type ExtractRequired<T> = T extends { required: readonly string[] } ? T['required'][number] : never;

// =================================================================
// 3. Core Parsers
// =================================================================

/**
 * Resolve Const (Literal)
 */
type ResolveConst<T> = T extends { const: infer C } ? C : never;

/**
 * Resolve Enum (Union)
 */
type ResolveEnum<T> = T extends { enum: readonly (infer E)[] } ? E : never;

/**
 * Resolve Union (anyOf / oneOf)
 *
 * LOGIC FIX:
 * Extracts the item type from the array and recursively applies InferSchema.
 * Because TypeScript conditional types are distributive, InferSchema<Item>
 * naturally creates a Union (A | B | C) instead of an Array.
 */
type ResolveUnion<T> = T extends { anyOf: readonly (infer U)[] }
  ? InferSchema<U>
  : T extends { oneOf: readonly (infer U)[] }
    ? InferSchema<U>
    : never;

/**
 * Resolve Array
 * Compatible with: type: 'array', type: Type.ARRAY
 */
type ResolveArray<T> = T extends { items: infer I } ? InferSchema<I>[] : unknown[];

/**
 * Resolve Additional Properties (Index Signature)
 */
type ResolveAdditional<T> = T extends { additionalProperties: infer AP }
  ? AP extends true
    ? Recordable
    : AP extends object // If AP is a Schema Object
      ? Recordable<InferSchema<AP>>
      : unknown
  : unknown; // Strict default: no index signature

/**
 * Resolve Object Properties
 */
type ResolveProperties<T> = T extends { properties: infer P }
  ? P extends Recordable
    ? Evaluate<
        {
          // Required Fields
          [K in keyof P as K extends ExtractRequired<T> ? K : never]: InferSchema<P[K]>;
        } & {
          // Optional Fields
          [K in keyof P as K extends ExtractRequired<T> ? never : K]?: InferSchema<P[K]>;
        }
      >
    : unknown
  : unknown;

/**
 * Resolve Object Structure
 * Combines Properties and AdditionalProperties
 */
type ResolveObject<T> = Evaluate<ResolveProperties<T> & ResolveAdditional<T>>;

/**
 * Resolve Primitive Types
 */
type ResolvePrimitive<T> = T extends { type: infer TType }
  ? TType extends keyof SchemaTypeMap
    ? SchemaTypeMap[TType]
    : unknown
  : unknown;

// =================================================================
// 4. Main Inference Entry
// =================================================================

export type InferSchema<T> =
  // 1. Const (Highest Priority)
  T extends { const: unknown }
    ? ResolveConst<T>
    : // 2. Enum
      T extends { enum: readonly unknown[] }
      ? ResolveEnum<T>
      : // 3. Union (anyOf / oneOf) - FIXED PRIORITY & LOGIC
        T extends { anyOf: readonly unknown[] } | { oneOf: readonly unknown[] }
        ? ResolveUnion<T>
        : // 4. Array
          T extends { type: 'array' | Type.ARRAY }
          ? ResolveArray<T>
          : // 5. Object (Explicit type or implicit properties)
            T extends { type: 'object' | Type.OBJECT } | { properties: unknown }
            ? ResolveObject<T>
            : // 6. Primitive
              ResolvePrimitive<T>;
