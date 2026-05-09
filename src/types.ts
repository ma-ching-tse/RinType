// Severity levels for text issues
export type Severity = 'error' | 'warning' | 'info';

// A single text issue found by a rule
export interface TextIssue {
  ruleId: string;
  message: string;
  original: string;
  replacement: string;
  offset: number;
  length: number;
}

// A text node with its issues
export interface NodeResult {
  nodeId: string;
  nodeName: string;
  text: string;
  issues: TextIssue[];
}

// Scan scope
export type ScanScope = 'frame' | 'selection';

// Rule metadata (sent to UI, without functions)
export interface RuleMeta {
  id: string;
  name: string;
  description: string;
  severity: Severity;
}
