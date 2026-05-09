import type { Rule } from './interface';
import type { TextIssue } from '../types';

// Full-width ASCII letters: Ａ-Ｚ (U+FF21-U+FF3A), ａ-ｚ (U+FF41-U+FF5A)
// Full-width digits: ０-９ (U+FF10-U+FF19)
const FULLWIDTH_ALNUM = /[\uff10-\uff19\uff21-\uff3a\uff41-\uff5a]/g;

function toHalfWidth(char: string): string {
  const code = char.charCodeAt(0);
  return String.fromCharCode(code - 0xfee0);
}

export const fullwidthHalfwidth: Rule = {
  id: 'fullwidth-halfwidth',
  name: '全角/半角',
  description: '英文字母和数字应使用半角字符',
  severity: 'error',

  check(text: string): TextIssue[] {
    const issues: TextIssue[] = [];
    const regex = new RegExp(FULLWIDTH_ALNUM.source, 'g');
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const char = match[0];
      issues.push({
        ruleId: this.id,
        message: `全角字符「${char}」应改为半角「${toHalfWidth(char)}」`,
        original: char,
        replacement: toHalfWidth(char),
        offset: match.index,
        length: 1,
      });
    }

    return issues;
  },

  fix(text: string): string {
    return text.replace(FULLWIDTH_ALNUM, (char) => toHalfWidth(char));
  },
};
