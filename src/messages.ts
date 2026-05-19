import type { NodeResult, RuleMeta, ScanScope } from './types';

// Messages from UI to plugin
export type UIMessage =
  | { type: 'scan'; scope: ScanScope }
  | { type: 'set-scope'; scope: ScanScope }
  | { type: 'fix-one'; nodeId: string; ruleId: string }
  | { type: 'fix-all' }
  | { type: 'focus-node'; nodeId: string };

// Messages from plugin to UI
export type PluginMessage =
  | { type: 'scan-results'; results: NodeResult[]; rules: RuleMeta[]; scannedCount: number }
  | { type: 'scan-progress'; current: number; total: number }
  | { type: 'fix-done'; nodeId: string; ruleId: string; newText: string }
  | { type: 'fix-all-done'; results: NodeResult[]; scannedCount: number }
  | { type: 'error'; message: string };
