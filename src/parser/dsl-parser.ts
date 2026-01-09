/**
 * DSL Parser for Flowchart Syntax
 *
 * Syntax:
 *   [Label]        - Rectangle (process step)
 *   {Label}        - Diamond (decision)
 *   (Label)        - Ellipse (start/end)
 *   [[Label]]      - Database
 *   A -> B         - Connection
 *   A -> "label" -> B  - Labeled connection
 *   A --> B        - Dashed connection
 *   @direction TB  - Set flow direction (TB, BT, LR, RL)
 *   @spacing N     - Set node spacing
 */

import { nanoid } from 'nanoid';
import type {
  FlowchartGraph,
  GraphNode,
  GraphEdge,
  LayoutOptions,
  NodeType,
} from '../types/dsl.js';
import { DEFAULT_LAYOUT_OPTIONS } from '../types/dsl.js';

interface Token {
  type: 'node' | 'arrow' | 'label' | 'directive' | 'newline';
  value: string;
  nodeType?: NodeType;
  dashed?: boolean;
}

/**
 * Tokenize DSL input into tokens
 */
function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = input.length;

  while (i < len) {
    // Skip whitespace (except newlines)
    if (input[i] === ' ' || input[i] === '\t') {
      i++;
      continue;
    }

    // Newline
    if (input[i] === '\n') {
      tokens.push({ type: 'newline', value: '\n' });
      i++;
      continue;
    }

    // Comment (skip rest of line)
    if (input[i] === '#') {
      while (i < len && input[i] !== '\n') i++;
      continue;
    }

    // Directive (@direction, @spacing)
    if (input[i] === '@') {
      let directive = '';
      i++; // skip @
      while (i < len && /[a-zA-Z0-9]/.test(input[i])) {
        directive += input[i];
        i++;
      }
      // Get directive value
      while (i < len && (input[i] === ' ' || input[i] === '\t')) i++;
      let value = '';
      while (i < len && input[i] !== '\n' && input[i] !== '#') {
        value += input[i];
        i++;
      }
      tokens.push({ type: 'directive', value: `${directive} ${value.trim()}` });
      continue;
    }

    // Database [[Label]]
    if (input[i] === '[' && input[i + 1] === '[') {
      i += 2;
      let label = '';
      while (i < len && !(input[i] === ']' && input[i + 1] === ']')) {
        label += input[i];
        i++;
      }
      i += 2; // skip ]]
      tokens.push({ type: 'node', value: label.trim(), nodeType: 'database' });
      continue;
    }

    // Rectangle [Label]
    if (input[i] === '[') {
      i++;
      let label = '';
      let depth = 1;
      while (i < len && depth > 0) {
        if (input[i] === '[') depth++;
        else if (input[i] === ']') depth--;
        if (depth > 0) label += input[i];
        i++;
      }
      tokens.push({ type: 'node', value: label.trim(), nodeType: 'rectangle' });
      continue;
    }

    // Diamond {Label}
    if (input[i] === '{') {
      i++;
      let label = '';
      let depth = 1;
      while (i < len && depth > 0) {
        if (input[i] === '{') depth++;
        else if (input[i] === '}') depth--;
        if (depth > 0) label += input[i];
        i++;
      }
      tokens.push({ type: 'node', value: label.trim(), nodeType: 'diamond' });
      continue;
    }

    // Ellipse (Label)
    if (input[i] === '(') {
      i++;
      let label = '';
      let depth = 1;
      while (i < len && depth > 0) {
        if (input[i] === '(') depth++;
        else if (input[i] === ')') depth--;
        if (depth > 0) label += input[i];
        i++;
      }
      tokens.push({ type: 'node', value: label.trim(), nodeType: 'ellipse' });
      continue;
    }

    // Dashed arrow -->
    if (input[i] === '-' && input[i + 1] === '-' && input[i + 2] === '>') {
      tokens.push({ type: 'arrow', value: '-->', dashed: true });
      i += 3;
      continue;
    }

    // Arrow ->
    if (input[i] === '-' && input[i + 1] === '>') {
      tokens.push({ type: 'arrow', value: '->' });
      i += 2;
      continue;
    }

    // Quoted label "text"
    if (input[i] === '"') {
      i++;
      let label = '';
      while (i < len && input[i] !== '"') {
        if (input[i] === '\\' && i + 1 < len) {
          i++;
          label += input[i];
        } else {
          label += input[i];
        }
        i++;
      }
      i++; // skip closing "
      tokens.push({ type: 'label', value: label });
      continue;
    }

    // Skip unknown characters
    i++;
  }

  return tokens;
}

/**
 * Parse tokens into a FlowchartGraph
 */
export function parseDSL(input: string): FlowchartGraph {
  const tokens = tokenize(input);

  const nodes: Map<string, GraphNode> = new Map();
  const edges: GraphEdge[] = [];
  const options: LayoutOptions = { ...DEFAULT_LAYOUT_OPTIONS };

  // Helper to get or create node by label
  function getOrCreateNode(label: string, type: NodeType): GraphNode {
    // Use label as key for deduplication
    const key = `${type}:${label}`;
    if (!nodes.has(key)) {
      nodes.set(key, {
        id: nanoid(10),
        type,
        label,
      });
    }
    return nodes.get(key)!;
  }

  let i = 0;
  let lastNode: GraphNode | null = null;
  let pendingLabel: string | null = null;
  let pendingDashed = false;

  while (i < tokens.length) {
    const token = tokens[i];

    if (token.type === 'newline') {
      lastNode = null;
      pendingLabel = null;
      pendingDashed = false;
      i++;
      continue;
    }

    if (token.type === 'directive') {
      const [directive, ...valueParts] = token.value.split(' ');
      const value = valueParts.join(' ');

      if (directive === 'direction') {
        const dir = value.toUpperCase();
        if (dir === 'TB' || dir === 'BT' || dir === 'LR' || dir === 'RL') {
          options.direction = dir;
        }
      } else if (directive === 'spacing') {
        const spacing = parseInt(value, 10);
        if (!isNaN(spacing)) {
          options.nodeSpacing = spacing;
        }
      }
      i++;
      continue;
    }

    if (token.type === 'node') {
      const node = getOrCreateNode(token.value, token.nodeType!);

      if (lastNode) {
        // Create edge from lastNode to this node
        edges.push({
          id: nanoid(10),
          source: lastNode.id,
          target: node.id,
          label: pendingLabel || undefined,
          style: pendingDashed ? { strokeStyle: 'dashed' } : undefined,
        });
        pendingLabel = null;
        pendingDashed = false;
      }

      lastNode = node;
      i++;
      continue;
    }

    if (token.type === 'arrow') {
      pendingDashed = token.dashed || false;
      i++;
      continue;
    }

    if (token.type === 'label') {
      pendingLabel = token.value;
      i++;
      continue;
    }

    i++;
  }

  return {
    nodes: Array.from(nodes.values()),
    edges,
    options,
  };
}

// Re-export DEFAULT_LAYOUT_OPTIONS
export { DEFAULT_LAYOUT_OPTIONS } from '../types/dsl.js';
