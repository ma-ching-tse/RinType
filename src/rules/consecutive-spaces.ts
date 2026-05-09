import type { Rule } from './interface';
import type { TextIssue } from '../types';

export const consecutiveSpaces: Rule = {
  id: 'consecutive-spaces',
  name: '连续空格',
  description: '将多个连续空格合并为一个',
  severity: 'warning',

  check(text: string): TextIssue[] {
    const issues: TextIssue[] = [];
    const regex = / {2,}/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      issues.push({
        ruleId: this.id,
        message: `发现 ${match[0].length} 个连续空格`,
        original: match[0],
        replacement: ' ',
        offset: match.index,
        length: match[0].length,
      });
    }

    return issues;
  },

  fix(text: string): string {
    return text.replace(/ {2,}/g, ' ');
  },
};
