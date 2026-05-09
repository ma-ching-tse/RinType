import type { NodeResult, TextIssue } from '../types';
import { allRules } from '../rules';

interface ScanTarget {
  nodeId: string;
  nodeName: string;
  text: string;
  textCase: string | null; // 'ORIGINAL' | 'UPPER' | 'LOWER' | 'TITLE' | 'SMALL_CAPS' | 'SMALL_CAPS_FORCED' | null (mixed)
}

// Check if a node is visible (not hidden)
function isVisible(node: BaseNode): boolean {
  // SceneNode has a 'visible' property; skip hidden nodes
  if ('visible' in node && (node as SceneNode).visible === false) {
    return false;
  }
  return true;
}

// Recursively collect all TEXT nodes from a subtree, skipping hidden layers
function collectTextNodes(node: BaseNode, targets: ScanTarget[]): void {
  // Skip hidden nodes and all their children
  if (!isVisible(node)) return;

  if (node.type === 'TEXT') {
    const textNode = node as TextNode;
    if (textNode.characters.length > 0) {
      // Read textCase; may be a string or figma.mixed if mixed styles
      const rawCase = textNode.textCase;
      const textCase = (typeof rawCase === 'string') ? rawCase : null;

      targets.push({
        nodeId: node.id,
        nodeName: node.name,
        text: textNode.characters,
        textCase,
      });
    }
    return;
  }

  if ('children' in node) {
    for (const child of (node as ChildrenMixin).children) {
      collectTextNodes(child, targets);
    }
  }
}

// Find the nearest parent frame/component of a node
function findParentFrame(node: BaseNode): BaseNode {
  let current: BaseNode | null = node;
  while (current) {
    if (
      current.type === 'FRAME' ||
      current.type === 'COMPONENT' ||
      current.type === 'COMPONENT_SET' ||
      current.parent === figma.currentPage // top-level node
    ) {
      return current;
    }
    current = current.parent;
  }
  return node;
}

// Collect text nodes based on scope
export function collectTargets(scope: 'frame' | 'selection'): ScanTarget[] {
  const targets: ScanTarget[] = [];
  const selection = figma.currentPage.selection;

  if (selection.length === 0) return targets;

  if (scope === 'selection') {
    for (const node of selection) {
      collectTextNodes(node, targets);
    }
  } else {
    // 'frame' scope: find the parent frame of the first selected node
    const parentFrame = findParentFrame(selection[0]);
    collectTextNodes(parentFrame, targets);
  }

  return targets;
}

// Rules that should be skipped when Figma's textCase handles capitalization
const CAPITALIZATION_RULES = new Set([
  'capitalization',
  'separator-capitalization',
  'sentence-capitalization',
]);

// Run all rules against a single text string, respecting textCase
export function checkText(text: string, textCase?: string | null): TextIssue[] {
  const issues: TextIssue[] = [];

  for (const rule of allRules) {
    // UPPER or TITLE textCase: Figma already handles capitalization visually
    if (textCase === 'UPPER' || textCase === 'TITLE') {
      if (CAPITALIZATION_RULES.has(rule.id)) continue;
    }

    issues.push(...rule.check(text));
  }

  return issues;
}

// Scan targets and return results (only nodes with issues)
export function scanTargets(targets: ScanTarget[]): NodeResult[] {
  const results: NodeResult[] = [];

  for (const target of targets) {
    const issues = checkText(target.text);
    if (issues.length > 0) {
      results.push({
        nodeId: target.nodeId,
        nodeName: target.nodeName,
        text: target.text,
        issues,
      });
    }
  }

  return results;
}
