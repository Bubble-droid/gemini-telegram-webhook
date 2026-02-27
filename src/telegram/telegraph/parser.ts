/**
 * Converts Markdown -> HTML -> Telegraph Node Structure.
 * Supports ALL Telegraph tags including video, iframe, aside, etc.
 */

import { marked } from 'marked';
import { NodeType, parse as parseHtml, type HTMLElement, type Node as HTMLNode } from 'node-html-parser';
import type { AvailableTag, ElementAttributes, Node, NodeElement } from './types.js';

// 1. Define Allowed Tags (Whitelist)
const ALLOWED_TAGS = new Set<AvailableTag>([
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
]);

const isHTMLElement = (node: HTMLNode): node is HTMLElement => {
  return node.nodeType === NodeType.ELEMENT_NODE;
};

const isTextNode = (node: HTMLNode): boolean => {
  return node.nodeType === NodeType.TEXT_NODE;
};

/**
 * Main function: Markdown String -> Telegraph Node Array
 */
export const markdownToTelegraph = async (markdown: string): Promise<Node[]> => {
  // 1. Convert Markdown to HTML using marked
  // gfm: true enables Strikethrough (~~text~~) -> <del>
  // breaks: true converts newlines to <br>
  const htmlContent = await marked.parse(markdown, { gfm: true, breaks: true });

  // 2. Parse HTML string to DOM Tree
  const root = parseHtml(htmlContent);

  // 3. Transform DOM Tree to Telegraph Nodes
  return domToTelegraph(root.childNodes);
};

/**
 * Recursive function to transform HTML Nodes to Telegraph Nodes
 */
const domToTelegraph = (nodes: HTMLNode[]): Node[] => {
  const telegraphNodes: Node[] = [];

  for (const node of nodes) {
    // Handle Text Nodes
    if (isTextNode(node)) {
      const text = node.text;
      // Skip empty whitespace nodes unless strictly needed, but Telegraph usually trims
      if (text.length > 0) {
        telegraphNodes.push(text);
      }
      continue;
    }

    // Handle Element Nodes
    if (isHTMLElement(node)) {
      const tagName = node.tagName.toLowerCase();

      // --- Special Mapping Rules ---

      // Rule 1: Header Mapping (Telegraph only supports h3, h4)
      if (['h1', 'h2'].includes(tagName)) {
        telegraphNodes.push({
          tag: 'h3',
          children: domToTelegraph(node.childNodes),
        });
        continue;
      }
      if (['h5', 'h6'].includes(tagName)) {
        telegraphNodes.push({
          tag: 'h4',
          children: domToTelegraph(node.childNodes),
        });
        continue;
      }

      // Rule 2: Strikethrough Mapping (<del> from GFM -> <s>)
      if (tagName === 'del' || tagName === 'strike') {
        telegraphNodes.push({
          tag: 's',
          children: domToTelegraph(node.childNodes),
        });
        continue;
      }

      if (tagName === 'pre') {
        // We need to check if <pre> wraps a <code> block.
        // It might also contain whitespace text nodes (newlines) before the code tag.

        // Find the first ELEMENT child (ignoring whitespace text nodes)
        const firstElementChild = node.childNodes.find((child) => isHTMLElement(child));

        // If the *only* element child is <code>, we unwrap it.
        // <pre><code>...</code></pre> -> <pre>...</pre> in Telegraph
        if (firstElementChild?.tagName.toLowerCase() === 'code') {
          telegraphNodes.push({
            tag: 'pre',
            children: domToTelegraph(firstElementChild.childNodes),
          });
          continue;
        }
      }

      if (tagName === 'ul' || tagName === 'ol') {
        const listChildren = domToTelegraph(node.childNodes);
        // Filter out any string nodes (whitespace) from the children
        const validListChildren = listChildren.filter((child) => typeof child !== 'string' && child.tag === 'li');

        if (validListChildren.length > 0) {
          telegraphNodes.push({
            tag: tagName as AvailableTag,
            children: validListChildren,
          });
        }
        continue;
      }

      // Rule 4: Allowed Tags Pass-through
      if (ALLOWED_TAGS.has(tagName as AvailableTag)) {
        const tNode: NodeElement = {
          tag: tagName as AvailableTag,
          children: domToTelegraph(node.childNodes),
        };

        // Extract Attributes (href, src)
        const attrs = extractAttributes(node);
        if (attrs) {
          tNode.attrs = attrs;
        }

        telegraphNodes.push(tNode);
        continue;
      }

      // Rule 5: Container/Unknown Tags (div, span, section) -> Unwrap Children
      // If a tag is not supported (e.g., <div>), we simply render its children
      // to avoid losing content.
      telegraphNodes.push(...domToTelegraph(node.childNodes));
    }
  }

  return telegraphNodes;
};

/**
 * Extract valid attributes for Telegraph
 */
const extractAttributes = (element: HTMLElement): ElementAttributes | undefined => {
  const attrs: ElementAttributes = {};
  const rawAttrs = element.attributes as ElementAttributes;

  // Telegraph mainly cares about 'href' and 'src'
  if (rawAttrs.href) attrs.href = rawAttrs.href;
  if (rawAttrs.src) attrs.src = rawAttrs.src;

  // Specific handling for Video/Iframe if needed (e.g. strict attribute filtering)
  // But generally, passing src is enough.

  return Object.keys(attrs).length > 0 ? attrs : undefined;
};
