import type { Severity, TextIssue } from '../types';

export interface Rule {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  check(text: string): TextIssue[];
  fix(text: string): string;
}
