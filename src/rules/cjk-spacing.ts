import type { Rule } from './interface';
import type { TextIssue } from '../types';

// CJK Unified Ideographs and common CJK ranges (excluding punctuation ranges)
const CJK = '\\u2e80-\\u2eff\\u2f00-\\u2fdf\\u3040-\\u309f\\u30a0-\\u30ff\\u3100-\\u312f\\u3200-\\u32ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff';

// CJK punctuation to exclude (fullwidth and CJK punctuation marks)
// Includes: ，。！？；：、""''（）【】《》〈〉「」『』〔〕｛｝ etc.
// These ranges cover CJK punctuation: U+3000-U+303F, U+FE30-U+FE4F, U+FF00-U+FF0F, U+FF1A-U+FF20, U+FF3B-U+FF40, U+FF5B-U+FF65

// Pattern: CJK char followed by ASCII letter/digit (no space between)
const CJK_THEN_ASCII = new RegExp(`([${CJK}])([A-Za-z0-9])`, 'g');
// Pattern: ASCII letter/digit followed by CJK char (no space between)
const ASCII_THEN_CJK = new RegExp(`([A-Za-z0-9])([${CJK}])`, 'g');

// For checking only
const CJK_THEN_ASCII_CHECK = new RegExp(`[${CJK}][A-Za-z0-9]`, 'g');
const ASCII_THEN_CJK_CHECK = new RegExp(`[A-Za-z0-9][${CJK}]`, 'g');

export const cjkSpacing: Rule = {
  id: 'cjk-spacing',
  name: '中英文间距',
  description: '中文与英文、数字之间需要添加空格（中文标点除外）',
  severity: 'error',

  check(text: string): TextIssue[] {
    const issues: TextIssue[] = [];

    let match: RegExpExecArray | null;

    CJK_THEN_ASCII_CHECK.lastIndex = 0;
    while ((match = CJK_THEN_ASCII_CHECK.exec(text)) !== null) {
      issues.push({
        ruleId: this.id,
        message: '中文与英文/数字之间缺少空格',
        original: match[0],
        replacement: match[0][0] + ' ' + match[0][1],
        offset: match.index,
        length: 2,
      });
    }

    ASCII_THEN_CJK_CHECK.lastIndex = 0;
    while ((match = ASCII_THEN_CJK_CHECK.exec(text)) !== null) {
      issues.push({
        ruleId: this.id,
        message: '英文/数字与中文之间缺少空格',
        original: match[0],
        replacement: match[0][0] + ' ' + match[0][1],
        offset: match.index,
        length: 2,
      });
    }

    return issues;
  },

  fix(text: string): string {
    return text
      .replace(CJK_THEN_ASCII, '$1 $2')
      .replace(ASCII_THEN_CJK, '$1 $2');
  },
};
