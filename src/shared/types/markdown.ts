// --- AST 节点类型定义 ---
export type NodeType =
  | 'root'
  | 'text'
  | 'bold'
  | 'underline'
  | 'strikethrough'
  | 'spoiler'
  | 'inline_code'
  | 'code_block'
  | 'unordered_list'
  | 'list_item'
  | 'link'
  | 'blockquote'
  | 'newline'; // 新增换行节点，便于处理

export interface AstNode {
  type: NodeType;
  children?: AstNode[];
  content?: string;
  indent?: string;
  lang?: string | undefined;
  href?: string;
  expandable?: boolean;
}
