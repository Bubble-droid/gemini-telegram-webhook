import { describe, expect, it } from 'vitest';
import { parseToolCalls } from './tool-call-parse.js';

describe('parseToolCalls Utility', () => {
  // --- 场景 1: 理想情况与标准协议 ---
  it('应当正确解析标准标签包裹的纯 JSON 数组', () => {
    const input = '<tool_calls>[{"name": "search", "args": {"q": "arch linux"}}]</tool_calls>';
    const result = parseToolCalls(input);

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('search');
    expect(result[0]?.args?.['q']).toBe('arch linux');
  });

  // --- 场景 2: 修复后的漏洞验证 (标签内包含代码块) ---
  it('应当正确处理标签内嵌套 Markdown 代码块的违规情况', () => {
    const input = `
    这是模型输出的一些废话：
      <tool_calls>
      \`\`\`json
      [{"name": "calculate", "args": {"expr": "1+1"}}]
      \`\`\`
      </tool_calls>
    `;
    const result = parseToolCalls(input);
    expect(result[0]?.name).toBe('calculate');
    expect(result[0]?.args?.['expr']).toBe('1+1');
  });

  // --- 场景 3: 降级/回退逻辑 (Fallback) ---
  it('当缺失标签但存在 Markdown 代码块时，应当能自动提取', () => {
    const input = '这是模型输出的一些废话：\n```json\n[{"name": "log", "args": {"msg": "hello"}}]\n```';
    const result = parseToolCalls(input);
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('log');
    expect(result[0]?.args?.['msg']).toBe('hello');
  });

  it('当没有任何标记，仅输出裸 JSON 数组时，应当通过正则兜底提取', () => {
    const input = '模型直接吐出了数组：[{"name": "direct_call", "args": {}}]，没有标签。';
    const result = parseToolCalls(input);
    expect(result[0]?.name).toBe('direct_call');
    expect(result[0]?.args).toEqual({});
  });

  // --- 场景 4: 严格类型与错误处理 ---
  it('当 JSON 格式合法但缺少必填属性（name/args）时，应当抛出错误', () => {
    const input = '<tool_calls>[{"wrong_key": "oops"}]</tool_calls>';

    // 验证是否抛出了具体的格式错误
    expect(() => parseToolCalls(input)).toThrow(/Could not find any valid ToolCall/);
  });

  it('当输入的 JSON 数组为空时，应当抛出解析失败错误', () => {
    const input = '<tool_calls>[]</tool_calls>';
    expect(() => parseToolCalls(input)).toThrow(/Could not find any valid ToolCall/);
  });

  it('当输入完全是乱码时，应当抛出错误', () => {
    const input = '这是一段完全没有工具调用的普通文本。';
    expect(() => parseToolCalls(input)).toThrow(/Could not find any valid ToolCall/);
  });

  // --- 场景 5: 并行调用处理 ---
  it('应当支持在一个数组内解析多个工具调用', () => {
    const input = '<tool_calls>[{"name": "a", "args": {}}, {"name": "b", "args": {}}]</tool_calls>';
    const result = parseToolCalls(input);
    expect(result).toHaveLength(2);
    expect(result).toMatchObject([
      { name: 'a', args: {} },
      { name: 'b', args: {} },
    ]);
  });

  it('模型输出多个 <tool_calls> 标签块，应全部解析并合并为一个工具调用数组', () => {
    const input = `
      <tool_calls>
        [{"name": "a", "args": {}}]
      </tool_calls>
      <tool_calls>
        [{"name": "b", "args": {}}]
      </tool_calls>
      `;
    const result = parseToolCalls(input);
    expect(result).toHaveLength(2);
    expect(result).toMatchObject([
      { name: 'a', args: {} },
      { name: 'b', args: {} },
    ]);
  });
});
