import type { NodeResult, TextIssue } from '../types';
import { allRules } from '../rules';
import { getUrlRanges, overlapsAny } from '../utils/url-ranges';
import { containsIdentifierKeyword } from '../utils/identifier-keywords';

interface ScanTarget {
  nodeId: string;
  nodeName: string;
  text: string;
  textCase: string | null; // 'ORIGINAL' | 'UPPER' | 'LOWER' | 'TITLE' | 'SMALL_CAPS' | 'SMALL_CAPS_FORCED' | null (mixed)
  // True when this node is a pure-numeric value whose direct-parent siblings contain
  // an identifier keyword (e.g. "Referral Code" label next to a "77887643" value node).
  // Used to skip thousand-separator across nodes.
  isLikelyIdentifier?: boolean;
}

const PURE_DIGITS = /^\d{4,}$/;

// Exposed for the fix path in code.ts so "fix all" can also skip thousand-separator
// on identifier value nodes.
export function isIdentifierValueNode(node: TextNode): boolean {
  if (!PURE_DIGITS.test(node.characters.trim())) return false;
  return hasIdentifierSibling(node);
}

// Look at direct-parent siblings (one level up only) for an identifier keyword. The user
// confirmed this scope: typical label/value pairs sit in the same row container.
function hasIdentifierSibling(node: TextNode): boolean {
  const parent = node.parent;
  if (!parent || !('children' in parent)) return false;
  for (const sibling of (parent as ChildrenMixin).children) {
    if (sibling === node) continue;
    if (sibling.type !== 'TEXT') continue;
    if (containsIdentifierKeyword((sibling as TextNode).characters)) return true;
  }
  return false;
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

      const trimmed = textNode.characters.trim();
      const isLikelyIdentifier =
        PURE_DIGITS.test(trimmed) && hasIdentifierSibling(textNode);

      targets.push({
        nodeId: node.id,
        nodeName: node.name,
        text: textNode.characters,
        textCase,
        isLikelyIdentifier,
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

// Find the nearest container ancestor of a node.
// Containers include: FRAME, COMPONENT, COMPONENT_SET, GROUP, or any top-level node.
// GROUP is included because some designers use groups instead of frames as logical containers.
function findParentFrame(node: BaseNode): BaseNode {
  let current: BaseNode | null = node;
  while (current) {
    if (
      current.type === 'FRAME' ||
      current.type === 'COMPONENT' ||
      current.type === 'COMPONENT_SET' ||
      current.type === 'GROUP' ||
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
export function checkText(
  text: string,
  textCase?: string | null,
  isLikelyIdentifier?: boolean,
): TextIssue[] {
  const issues: TextIssue[] = [];
  const urlRanges = getUrlRanges(text);

  for (const rule of allRules) {
    // UPPER or TITLE textCase: Figma already handles capitalization visually
    if (textCase === 'UPPER' || textCase === 'TITLE') {
      if (CAPITALIZATION_RULES.has(rule.id)) continue;
    }

    // Cross-node identifier detection: a pure-numeric node whose sibling contains
    // a keyword like "Referral Code" is treated as an identifier value.
    if (isLikelyIdentifier && rule.id === 'thousand-separator') continue;

    const ruleIssues = rule.check(text);

    // URLs are sensitive (case, path, params) — skip any issue overlapping a URL.
    // `url-spacing` is the exception: it operates on URL boundaries by design.
    if (rule.id !== 'url-spacing' && urlRanges.length > 0) {
      for (const issue of ruleIssues) {
        if (!overlapsAny(issue.offset, issue.offset + issue.length, urlRanges)) {
          issues.push(issue);
        }
      }
    } else {
      issues.push(...ruleIssues);
    }
  }

  return issues;
}

// Scan targets and return results (only nodes with issues)
export function scanTargets(targets: ScanTarget[]): NodeResult[] {
  const results: NodeResult[] = [];

  for (const target of targets) {
    const issues = checkText(target.text, target.textCase, target.isLikelyIdentifier);
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
