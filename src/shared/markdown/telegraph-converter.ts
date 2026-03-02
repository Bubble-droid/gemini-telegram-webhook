// telegraph-converter.ts

import { marked } from 'marked';
import type { HTMLElement, Node, TextNode } from 'node-html-parser';
import { NodeType, parse } from 'node-html-parser';
import type {
  AllowedTag,
  NodeElement,
  Node as TelegraphNode,
  NodeElement as TelegraphNodeElement,
} from 'telegraph-api-client';

type SelfClosingTag = Extract<AllowedTag, 'img' | 'br' | 'hr' | 'iframe' | 'video'>;

// Set of tags officially supported by the Telegraph API
const ALLOWED_TAGS = new Set<string>([
  'a',
  'aside',
  'b',
  'blockquote',
  'br',
  'code',
  'em',
  'figcaption',
  'figure',
  'h3',
  'h4',
  'hr',
  'i',
  'iframe',
  'img',
  'li',
  'ol',
  'p',
  'pre',
  's',
  'strong',
  'u',
  'ul',
  'video',
] satisfies AllowedTag[]);

// Set of self-closing elements that do not require child text nodes
const SELF_CLOSING_TAGS = new Set<string>(['img', 'br', 'hr', 'iframe', 'video'] satisfies SelfClosingTag[]);

// Tags that act as structural blocks and should not contain direct whitespace text nodes
const STRUCTURAL_BLOCK_TAGS = new Set(['', 'root', 'ul', 'ol', 'figure', 'blockquote', 'aside']);

/**
 * Transforms standard Markdown input into a Telegraph API compatible DOM Node array.
 *
 * @param markdown - The standard raw markdown string.
 * @returns A promise that resolves to an array of TelegraphNode elements.
 */
export const markdownToTelegraph = async (markdown: string): Promise<TelegraphNode[]> => {
  const html = await marked.parse(markdown, { async: true, gfm: true, breaks: true });
  const root = parse(html);

  const result: TelegraphNode[] = [];
  for (const child of root.childNodes) {
    const processed = processHtmlNode(child, 'root', false);
    if (processed !== null) {
      if (Array.isArray(processed)) {
        result.push(...processed);
      } else {
        result.push(processed);
      }
    }
  }

  // Telegraph API rejects payload arrays completely empty of text nodes.
  // We provide a fallback empty paragraph if the resulting parsing yields nothing.
  if (result.length === 0) {
    result.push({ tag: 'p', children: [''] });
  }

  return result;
};

/**
 * Recursively traverses the HTML AST and converts it to a TelegraphNode AST.
 * Incorporates a context-aware whitespace removal logic to prevent layout breakage.
 *
 * @param node - The current HTML Node from the AST.
 * @param parentTag - The tag name of the parent element (used for context-aware spacing).
 * @param isPre - Boolean flag indicating if the current traversal is inside a <pre> block.
 */
const processHtmlNode = (node: Node, parentTag = '', isPre = false): TelegraphNode | TelegraphNode[] | null => {
  // Base case: Text node (nodeType === 3)
  if (node.nodeType === NodeType.TEXT_NODE) {
    const textNode = node as TextNode;
    const textContent = textNode.text;

    if (!textContent) return null;

    // Inside a <pre> block, formatting and newlines must be strictly preserved
    if (isPre) return textContent;

    // Normalize formatting whitespaces (newlines/tabs) to standard spaces to mimic browser rendering
    const normalizedText = textContent.replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ');

    // If the node is purely a space, drop it if it exists at the root or directly inside structural blocks
    if (normalizedText === ' ') {
      if (STRUCTURAL_BLOCK_TAGS.has(parentTag)) {
        return null;
      }
    }

    return normalizedText;
  }

  // Recursive case: Element node (nodeType === 1)
  if (node.nodeType === NodeType.ELEMENT_NODE) {
    const element = node as HTMLElement;
    const originalTag = element.tagName.toLowerCase();

    if (!originalTag) return null;

    const mappedTag = mapTagName(originalTag);
    const childIsPre = isPre || mappedTag === 'pre';
    const childrenNodes: TelegraphNode[] = [];
    if (
      mappedTag === 'pre' &&
      element.childNodes.length === 1 &&
      element.childNodes[0]?.nodeType === NodeType.TEXT_NODE
    ) {
      const rawHtmlContent = (element.childNodes[0] as TextNode).rawText;
      const innerAst = parse(rawHtmlContent);

      for (const innerChild of innerAst.childNodes) {
        const result = processHtmlNode(innerChild, 'pre', true);
        if (result !== null) {
          console.log(JSON.stringify(result, null, 2));
          childrenNodes.push(formatCodeBlock(result as NodeElement));
        }
      }
    } else {
      // Standard child node traversal
      for (const child of element.childNodes) {
        const result = processHtmlNode(child, mappedTag, childIsPre);
        if (result !== null) {
          if (Array.isArray(result)) {
            childrenNodes.push(...result);
          } else {
            childrenNodes.push(result);
          }
        }
      }
    }

    if (ALLOWED_TAGS.has(mappedTag)) {
      const nodeObj: TelegraphNodeElement = { tag: mappedTag };
      if (Object.keys(element.attrs).length > 0) {
        nodeObj.attrs = element.attrs;
      }

      if (childrenNodes.length > 0) {
        nodeObj.children = childrenNodes;
      } else if (!SELF_CLOSING_TAGS.has(mappedTag)) {
        return null;
      }

      return nodeObj;
    }

    return childrenNodes.length > 0 ? childrenNodes : null;
  }

  return null;
};

const formatCodeBlock = (element: TelegraphNodeElement): string => {
  const language = element.attrs?.['class']?.split('-')[1] ?? 'Unknown';
  const code = (element.children?.[0] ?? '') as string;
  const separator = '—'.repeat(language.length + 2);
  const header = `// Language: ${language}\n// ${separator}\n`;
  return header + code;
};

/**
 * Maps standard HTML tags to their closest Telegraph equivalent.
 * Telegraph strictly limits headings to <h3> and <h4>.
 */
const mapTagName = (tag: string): string => {
  switch (tag) {
    case 'h1':
    case 'h2':
      return 'h3';
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return 'h4';
    case 'del':
    case 'strike':
      return 's';
    case 'ins':
      return 'u';
    case 'mark':
      return 'em';
    default:
      return tag;
  }
};
