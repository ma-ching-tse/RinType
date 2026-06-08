import type { UIMessage, PluginMessage } from './messages';
import type { RuleMeta, NodeResult } from './types';
import { collectTargets, isIdentifierValueNode } from './scanner';
import { scanInBatches } from './scanner/batch';
import { allRules, ruleMap } from './rules';
import { fixOutsideUrls } from './utils/url-ranges';
import { createTelemetry, generateInstallId, type TelemetryIdentity } from './telemetry/telemetry';

// Show plugin UI
figma.showUI(__html__, {
  width: 420,
  height: 620,
  themeColors: true,
});

// Team-wide usage reporting — always on, no opt-out UI by design (matches
// RinScanner). Points at the SAME ingest server; events carry product:'rintype'
// so the shared events.jsonl stays separable. MUST be HTTPS — Figma blocks
// plugin requests to insecure http:// URLs (mixed content). Reporting is
// fire-and-forget and fully silent, so it never affects the plugin.
const TELEMETRY_URL = 'https://47.79.20.248.sslip.io/telemetry';
const INSTALL_ID_KEY = 'rintype-install-id';
let telemetryIdentity: TelemetryIdentity = { installId: '', userId: null, userName: null };

const telemetry = createTelemetry(
  () => ({ url: TELEMETRY_URL }),
  () => ({
    identity: telemetryIdentity,
    file: { fileKey: figma.fileKey ?? null, fileName: figma.root.name || null },
  }),
);

// Resolve a stable install id + named identity for reporting (fire-and-forget).
(async function initTelemetryIdentity() {
  try {
    let installId = await figma.clientStorage.getAsync(INSTALL_ID_KEY);
    if (typeof installId !== 'string' || !installId) {
      installId = generateInstallId();
      await figma.clientStorage.setAsync(INSTALL_ID_KEY, installId);
    }
    telemetryIdentity = {
      installId,
      userId: figma.currentUser?.id ?? null,
      userName: figma.currentUser?.name ?? null,
    };
  } catch {
    // clientStorage unavailable — leave identity blank; reporting still works (anonymous install).
  }
})();

// Summarise a scan result set into the telemetry `found` shape: total issue
// count + per-rule breakdown. Never includes the matched text itself.
function summarizeFound(results: NodeResult[]): { total: number; byRule: Record<string, number> } {
  const byRule: Record<string, number> = {};
  let total = 0;
  for (const r of results) {
    for (const issue of r.issues) {
      byRule[issue.ruleId] = (byRule[issue.ruleId] || 0) + 1;
      total++;
    }
  }
  return { total, byRule };
}

function countIssues(results: NodeResult[]): number {
  let total = 0;
  for (const r of results) total += r.issues.length;
  return total;
}

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

async function autoScan(): Promise<{ results: NodeResult[]; scannedCount: number }> {
  try {
    const targets = collectTargets(currentScope);

    if (targets.length === 0) {
      send({ type: 'scan-results', results: [], rules: rulesMeta, scannedCount: 0 });
      return { results: [], scannedCount: 0 };
    }

    const results = await scanInBatches(targets, (current, total) => {
      send({ type: 'scan-progress', current, total });
    });

    send({ type: 'scan-results', results, rules: rulesMeta, scannedCount: targets.length });
    return { results, scannedCount: targets.length };
  } catch (err) {
    send({ type: 'error', message: String(err) });
    return { results: [], scannedCount: 0 };
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

// Apply fix for a specific rule on a node
async function fixNode(nodeId: string, ruleId: string): Promise<string | null> {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node || node.type !== 'TEXT') return null;

  const textNode = node as TextNode;
  const rule = ruleMap.get(ruleId);
  if (!rule) return null;

  // url-spacing legitimately operates on URL boundaries; other rules must not touch URLs.
  const newText = rule.id === 'url-spacing'
    ? rule.fix(textNode.characters)
    : fixOutsideUrls(textNode.characters, (s) => rule.fix(s));
  if (newText === textNode.characters) return null;

  await loadFonts(textNode);
  textNode.characters = newText;
  return newText;
}

// Apply all rules to fix a node's text
async function fixNodeAll(nodeId: string): Promise<string | null> {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node || node.type !== 'TEXT') return null;

  const textNode = node as TextNode;
  let text = textNode.characters;
  const skipThousandSep = isIdentifierValueNode(textNode);

  for (const rule of allRules) {
    if (skipThousandSep && rule.id === 'thousand-separator') continue;
    text = rule.id === 'url-spacing'
      ? rule.fix(text)
      : fixOutsideUrls(text, (s) => rule.fix(s));
  }

  if (text === textNode.characters) return null;

  await loadFonts(textNode);
  textNode.characters = text;
  return text;
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
      // Only the explicit "scan" action is reported — never the debounced
      // auto-scan that fires on every selection change (would flood the server).
      const { results, scannedCount } = await autoScan();
      telemetry.track({
        event: 'scan',
        scanned: scannedCount,
        scope: currentScope,
        found: summarizeFound(results),
      });
      break;
    }

    case 'fix-one': {
      suppressAutoScan = true;
      try {
        const newText = await fixNode(msg.nodeId, msg.ruleId);
        if (newText !== null) {
          send({ type: 'fix-done', nodeId: msg.nodeId, ruleId: msg.ruleId, newText });
          telemetry.track({ event: 'fix', fixKind: msg.ruleId, count: 1 });
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
        const issuesBefore = countIssues(results);

        // Fix all nodes
        for (const result of results) {
          await fixNodeAll(result.nodeId);
        }

        // Re-scan to show remaining issues
        const updatedTargets = collectTargets(currentScope);
        const updatedResults = await scanInBatches(updatedTargets, () => {});
        send({ type: 'fix-all-done', results: updatedResults, scannedCount: updatedTargets.length });
        const fixedCount = Math.max(0, issuesBefore - countIssues(updatedResults));
        if (fixedCount > 0) telemetry.track({ event: 'fix', fixKind: 'all', count: fixedCount });
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
