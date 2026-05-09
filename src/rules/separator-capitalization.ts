import type { Rule } from './interface';
import type { TextIssue } from '../types';

// Match word characters after separators (/ | — – ·)
// Captures: optional spaces + separator + optional spaces + lowercase letter
const SEPARATOR_PATTERN = /(?:^|[\s])([/|—–·])\s*([a-z])/g;
// Also match the very beginning of text before a separator
const START_BEFORE_SEP = /^([a-z])(\w*\s*[/|—–·])/g;

export const separatorCapitalization: Rule = {
  id: 'separator-capitalization',
  name: '分割线首字母大写',
  description: '分割线前后的文本首字母应大写',
  severity: 'warning',

  check(text: string): TextIssue[] {
    // Only apply when text contains at least one separator
    if (!/[/|—–·]/.test(text)) return [];

    const issues: TextIssue[] = [];

    // Check text after separators
    const afterRegex = new RegExp(SEPARATOR_PATTERN.source, 'g');
    let match: RegExpExecArray | null;

    while ((match = afterRegex.exec(text)) !== null) {
      const letter = match[2];
      const offset = match.index + match[0].length - 1;
      issues.push({
        ruleId: this.id,
        message: `分割线后「${letter}」应大写为「${letter.toUpperCase()}」`,
        original: letter,
        replacement: letter.toUpperCase(),
        offset,
        length: 1,
      });
    }

    // Check text before first separator (beginning of segment)
    const segments = text.split(/\s*[/|—–·]\s*/);
    let pos = 0;
    for (const segment of segments) {
      const trimmed = segment.replace(/^\s+/, '');
      const startOffset = text.indexOf(trimmed, pos);
      if (trimmed.length > 0 && /^[a-z]/.test(trimmed)) {
        issues.push({
          ruleId: this.id,
          message: `分割线前「${trimmed[0]}」应大写为「${trimmed[0].toUpperCase()}」`,
          original: trimmed[0],
          replacement: trimmed[0].toUpperCase(),
          offset: startOffset,
          length: 1,
        });
      }
      pos = startOffset + trimmed.length;
    }

    // Deduplicate by offset
    const seen = new Set<number>();
    return issues.filter((issue) => {
      if (seen.has(issue.offset)) return false;
      seen.add(issue.offset);
      return true;
    });
  },

  fix(text: string): string {
    if (!/[/|—–·]/.test(text)) return text;
    // Split by separators, capitalize first letter of each segment
    const separatorRegex = /(\s*[/|—–·]\s*)/g;
    const parts = text.split(separatorRegex);

    return parts
      .map((part, i) => {
        // Even indices are text segments, odd indices are separators
        if (i % 2 === 0 && part.length > 0) {
          const trimMatch = part.match(/^\s*/);
          const trimStart = trimMatch ? trimMatch[0] : '';
          const rest = part.slice(trimStart.length);
          if (rest.length > 0) {
            return trimStart + rest[0].toUpperCase() + rest.slice(1);
          }
        }
        return part;
      })
      .join('');
  },
};
