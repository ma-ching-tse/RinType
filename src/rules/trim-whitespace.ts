import type { Rule } from './interface';
import type { TextIssue } from '../types';

export const trimWhitespace: Rule = {
  id: 'trim-whitespace',
  name: '首尾空白',
  description: '去除文本首尾的多余空白字符',
  severity: 'warning',

  check(text: string): TextIssue[] {
    const issues: TextIssue[] = [];

    const leadingMatch = text.match(/^\s+/);
    if (leadingMatch) {
      issues.push({
        ruleId: this.id,
        message: '文本开头有多余空白',
        original: leadingMatch[0],
        replacement: '',
        offset: 0,
        length: leadingMatch[0].length,
      });
    }

    const trailingMatch = text.match(/\s+$/);
    if (trailingMatch) {
      issues.push({
        ruleId: this.id,
        message: '文本末尾有多余空白',
        original: trailingMatch[0],
        replacement: '',
        offset: text.length - trailingMatch[0].length,
        length: trailingMatch[0].length,
      });
    }

    return issues;
  },

  fix(text: string): string {
    return text.trim();
  },
};
