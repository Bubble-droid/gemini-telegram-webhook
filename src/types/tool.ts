// src/types/tool.ts

import type { functionDeclarations } from '@/configs';
import type { OnToolStartCallback, RetryCallback } from '@/services';
import type { Type } from '@google/genai';

// --- 基础类型定义 ---

type ToolResult<T = unknown> = { result: T };

export interface CallBackFns {
  onToolStart: OnToolStartCallback;
  onRetry: RetryCallback;
}

// --- 核心推断逻辑 ---

// 1. 基础类型映射表 (移除 ARRAY 和 OBJECT，因为它们需要递归处理)
type PrimitiveTypeMap = {
  [Type.STRING]: string;
  [Type.NUMBER]: number;
  [Type.INTEGER]: number;
  [Type.BOOLEAN]: boolean;
  [Type.NULL]: null;
};

/**
 * 对象结构推断器
 * 负责遍历 properties，处理 required 字段，并递归调用 InferSchemaType 推断属性值
 */
type InferObjectSchema<T> = T extends { properties: infer TProps }
  ? {
      // 遍历所有属性 Key
      [K in keyof TProps]: K extends (T extends { required: readonly string[] } ? T['required'][number] : never) // 检查是否在 required 数组中
        ? InferSchemaType<TProps[K]> // 必填：直接递归推断类型
        : InferSchemaType<TProps[K]> | undefined; // 非必填：添加 undefined
    }
  : Record<string, unknown>; // 如果是 Object 但没有 properties 定义，回退到宽泛类型

/**
 * 主递归类型解释器
 * 根据 Schema 节点的特征分发到不同的处理逻辑
 */
type InferSchemaType<TProp> =
  // 1. 优先处理 ENUM 限制 (最高优先级)
  TProp extends { enum: readonly (infer E)[] }
    ? E
    : // 2. 处理 ARRAY 结构 (递归)
      TProp extends { type: Type.ARRAY }
      ? TProp extends { items: infer TItems }
        ? InferSchemaType<TItems>[] // 递归推断数组内部元素
        : unknown[]
      : // 3. 处理 OBJECT 结构 (递归 - 互递归调用 InferObjectSchema)
        TProp extends { type: Type.OBJECT }
        ? InferObjectSchema<TProp>
        : // 4. 处理 基础类型 (查表)
          TProp extends { type: infer TType }
          ? TType extends keyof PrimitiveTypeMap
            ? PrimitiveTypeMap[TType]
            : unknown
          : // 5. 兜底 (例如没有 type 字段，但有 properties，通常也视为 Object)
            TProp extends { properties: Record<string, unknown> }
            ? InferObjectSchema<TProp>
            : unknown;

// --- 工具辅助类型 ---

// 提取单个工具的定义
type GetToolDef<TName extends ToolName> = Extract<(typeof functionDeclarations)[number], { name: TName }>;

// --- 最终导出类型 ---

// 提取工具名称联合类型
export type ToolName = (typeof functionDeclarations)[number]['name'];

/**
 * 推断工具参数类型
 * 直接定位到 parameters 节点，它本质上就是一个 Object Schema，
 * 所以直接扔给 InferSchemaType 处理即可实现全链路递归。
 */
export type InferToolArgs<TName extends ToolName> =
  GetToolDef<TName> extends { parameters: infer TParams } ? InferSchemaType<TParams> : undefined;

// 定义执行器函数签名
type ToolExecutorFn<TName extends ToolName> = (
  args: InferToolArgs<TName>,
  callBacks: CallBackFns,
) => ToolResult | Promise<ToolResult>;

// 定义执行器映射表
export type ToolExecutorsMap = {
  [K in ToolName]: ToolExecutorFn<K>;
};

// 类型级别的查找工具：查找数组 T 中，Key 属性的值为 Value 的元素类型
type FindBy<T extends readonly unknown[], Key extends keyof T[number], Value> = T[number] extends infer U
  ? U extends { [K in Key]: Value }
    ? U // 找到了匹配项
    : never // 不匹配，丢弃
  : never;

// 1. 找到目标声明的类型
type UseFileSearchDeclaration = FindBy<typeof functionDeclarations, 'name', 'use_file_search'>;

// 2. 提取联合类型 (接下来的步骤与前一个方法相同)
type EnumArrayType = UseFileSearchDeclaration['parameters']['properties']['fileStores']['items']['enum'];
export type FileSearchStoreDisplayName = EnumArrayType[number];
