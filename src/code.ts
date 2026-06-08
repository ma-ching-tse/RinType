import type { UIMessage, PluginMessage } from './messages';
import type { RuleMeta, TextIssue } from './types';
import { collectTargets, isIdentifierValueNode } from './scanner';
import { scanInBatches } from './scanner/batch';
import { allRules, ruleMap } from './rules';
import { getUrlRanges, overlapsAny } from './utils/url-ranges';

// Show plugin UI
figma.showUI(__html__, {
  width: 420,
  height: 620,
  themeColors: true,
});

// Build rule metadata for the UI
const rulesMeta: RuleMeta[] = allRules.map((r) => ({
  id: r.id,
  name: r.name,
  description: r.description,
  severity: r.severity,
}));

// Track current scope from UI
let currentScope: 'frame' | 'selection' = 'frame';

// Flag to suppress auto-scan during programmatic operations (focus, fix)
let suppressAutoScan = false;

// Send message to UI
function send(msg: PluginMessage): void {
  figma.ui.postMessage(msg);
}

// Auto-scan based on current selection and scope
let scanTimer: number | null = null;

async function autoScan(): Promise<void> {
  try {
    const targets = collectTargets(currentScope);

    if (targets.length === 0) {
      send({ type: 'scan-results', results: [], rules: rulesMeta, scannedCount: 0 });
      return;
    }

    const results = await scanInBatches(targets, (current, total) => {
      send({ type: 'scan-progress', current, total });
    });

    send({ type: 'scan-results', results, rules: rulesMeta, scannedCount: targets.length });
  } catch (err) {
    send({ type: 'error', message: String(err) });
  }
}

// Debounced auto-scan to avoid scanning too frequently during rapid selection changes
function debouncedAutoScan(): void {
  if (suppressAutoScan) return;

  if (scanTimer !== null) {
    clearTimeout(scanTimer);
  }
  scanTimer = setTimeout(function() {
    scanTimer = null;
    autoScan();
  }, 200) as unknown as number;
}

// Listen for selection changes
figma.on('selectionchange', function() {
  debouncedAutoScan();
});

// Load all fonts used by a text node
async function loadFonts(node: TextNode): Promise<void> {
  const len = node.characters.length;
  if (len === 0) return;

  const fonts = node.getRangeAllFontNames(0, len);
  for (const font of fonts) {
    await figma.loadFontAsync(font);
  }
}

// Filter out issues whose ranges fall inside URLs (URLs are case/character sensitive).
// The url-spacing rule itself is allowed to operate on URL boundaries.
function filterUrlSafe(issues: TextIssue[], text: string, ruleId: string): TextIssue[] {
  if (ruleId === 'url-spacing') return issues;
  const urlRanges = getUrlRanges(text);
  if (urlRanges.length === 0) return issues;
  return issues.filter((i) => !overlapsAny(i.offset, i.offset + i.length, urlRanges));
}

// Apply issues to a text node surgically, preserving per-range styles.
// `deleteCharacters` + `insertCharacters` keep styling on untouched characters,
// unlike `textNode.characters = ...` which flattens all per-range styles.
async function applyIssues(textNode: TextNode, issues: TextIssue[]): Promise<void> {
  if (issues.length === 0) return;

  // Sort by offset descending so earlier edits don't shift later offsets.
  const sorted = issues.slice().sort((a, b) => b.offset - a.offset);

  // Drop any overlapping issues — keep the rightmost ones we encounter first.
  const safe: TextIssue[] = [];
  let nextStart = Infinity;
  for (const issue of sorted) {
    const end = issue.offset + issue.length;
    if (end <= nextStart) {
      safe.push(issue);
      nextStart = issue.offset;
    }
  }

  for (const issue of safe) {
    const start = issue.offset;
    const end = issue.offset + issue.length;

    if (end > start) {
      textNode.deleteCharacters(start, end);
    }
    if (issue.replacement.length > 0) {
      // 'BEFORE' inherits the style of the char at start-1; 'AFTER' inherits the char now at start.
      // At index 0 there's no preceding char, so fall back to 'AFTER'.
      const useStyle: 'BEFORE' | 'AFTER' = start === 0 ? 'AFTER' : 'BEFORE';
      textNode.insertCharacters(start, issue.replacement, useStyle);
    }
  }
}

// Apply fix for a specific rule on a node (preserving per-range styles)
async function fixNode(nodeId: string, ruleId: string): Promise<string | null> {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node || node.type !== 'TEXT') return null;

  const textNode = node as TextNode;
  const rule = ruleMap.get(ruleId);
  if (!rule) return null;

  const before = textNode.characters;
  const issues = filterUrlSafe(rule.check(before), before, rule.id);
  if (issues.length === 0) return null;

  await loadFonts(textNode);
  await applyIssues(textNode, issues);

  const after = textNode.characters;
  return after === before ? null : after;
}

// Apply all rules to fix a node's text (preserving per-range styles)
async function fixNodeAll(nodeId: string): Promise<string | null> {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node || node.type !== 'TEXT') return null;

  const textNode = node as TextNode;
  const original = textNode.characters;
  const skipThousandSep = isIdentifierValueNode(textNode);

  await loadFonts(textNode);

  for (const rule of allRules) {
    if (skipThousandSep && rule.id === 'thousand-separator') continue;

    const currentText = textNode.characters;
    const issues = filterUrlSafe(rule.check(currentText), currentText, rule.id);
    if (issues.length > 0) {
      await applyIssues(textNode, issues);
    }
  }

  const after = textNode.characters;
  return after === original ? null : after;
}

// Handle messages from UI
figma.ui.onmessage = async (msg: UIMessage) => {
  switch (msg.type) {
    case 'set-scope': {
      currentScope = msg.scope;
      debouncedAutoScan();
      break;
    }

    case 'scan': {
      currentScope = msg.scope;
      await autoScan();
      break;
    }

    case 'fix-one': {
      suppressAutoScan = true;
      try {
        const newText = await fixNode(msg.nodeId, msg.ruleId);
        if (newText !== null) {
          send({ type: 'fix-done', nodeId: msg.nodeId, ruleId: msg.ruleId, newText });
        } else {
          send({ type: 'error', message: '修复失败：文本未发生变化或节点不存在' });
        }
      } catch (err) {
        send({ type: 'error', message: '修复失败：' + String(err) });
      }
      suppressAutoScan = false;
      break;
    }

    case 'fix-all': {
      suppressAutoScan = true;
      try {
        // Re-scan to get current state
        const targets = collectTargets(currentScope);
        const results = await scanInBatches(targets, () => {});

        // Fix all nodes
        for (const result of results) {
          await fixNodeAll(result.nodeId);
        }

        // Re-scan to show remaining issues
        const updatedTargets = collectTargets(currentScope);
        const updatedResults = await scanInBatches(updatedTargets, () => {});
        send({ type: 'fix-all-done', results: updatedResults, scannedCount: updatedTargets.length });
      } catch (err) {
        send({ type: 'error', message: '全部修复失败：' + String(err) });
      }
      suppressAutoScan = false;
      break;
    }

    case 'focus-node': {
      suppressAutoScan = true;
      try {
        const node = await figma.getNodeByIdAsync(msg.nodeId);
        if (node) {
          figma.currentPage.selection = [node as SceneNode];
          figma.viewport.scrollAndZoomIntoView([node as SceneNode]);
        }
      } catch (err) {
        send({ type: 'error', message: '定位失败：' + String(err) });
      }
      // Delay re-enabling auto-scan to let selectionchange event pass
      setTimeout(function() { suppressAutoScan = false; }, 300);
      break;
    }
  }
};
