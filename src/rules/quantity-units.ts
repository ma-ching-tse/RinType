import type { Rule } from './interface';
import type { TextIssue } from '../types';

// Quantity units should all be uppercase: K (thousand), M (million), B (billion)
// Pattern: digit(s) followed by k/m/b (case insensitive), not followed by another letter
// Use currency sign or common quantity contexts to distinguish from time units
// Match: $5m, 10k, 3.5b, 100M — quantity context
// Uses capturing groups instead of lookbehind for Figma sandbox compatibility
const QUANTITY_PATTERN = /(\d)([KkBb])(?![A-Za-z])/g;
// For M/m after $, it's quantity (million), not time (month)
const QUANTITY_M_PATTERN = /(\$[\d,.]+)([Mm])(?![A-Za-z])/g;

export const quantityUnits: Rule = {
  id: 'quantity-units',
  name: '计量单位大小写',
  description: '计量单位均大写（K/M/B）',
  severity: 'warning',

  check(text: string): TextIssue[] {
    const issues: TextIssue[] = [];

    const regex1 = new RegExp(QUANTITY_PATTERN.source, QUANTITY_PATTERN.flags);
    let match: RegExpExecArray | null;

    while ((match = regex1.exec(text)) !== null) {
      const found = match[2];
      const correct = found.toUpperCase();
      if (found !== correct) {
        issues.push({
          ruleId: this.id,
          message: `计量单位「${found}」应为大写「${correct}」`,
          original: found,
          replacement: correct,
          offset: match.index + match[1].length,
          length: 1,
        });
      }
    }

    const regex2 = new RegExp(QUANTITY_M_PATTERN.source, QUANTITY_M_PATTERN.flags);
    while ((match = regex2.exec(text)) !== null) {
      const found = match[2];
      const correct = found.toUpperCase();
      if (found !== correct) {
        issues.push({
          ruleId: this.id,
          message: `计量单位「${found}」应为大写「${correct}」`,
          original: found,
          replacement: correct,
          offset: match.index + match[1].length,
          length: 1,
        });
      }
    }

    return issues;
  },

  fix(text: string): string {
    let result = text.replace(QUANTITY_PATTERN, (_full, prefix: string, unit: string) =>
      prefix + unit.toUpperCase()
    );
    result = result.replace(QUANTITY_M_PATTERN, (_full, prefix: string, unit: string) =>
      prefix + unit.toUpperCase()
    );
    return result;
  },
};
