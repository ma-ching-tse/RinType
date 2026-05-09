import type { Rule } from './interface';
import type { TextIssue } from '../types';

// CJK character range
const CJK = '\\u2e80-\\u2eff\\u2f00-\\u2fdf\\u3040-\\u309f\\u30a0-\\u30ff\\u3100-\\u312f\\u3200-\\u32ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff\\ufe30-\\ufe4f\\uff00-\\uffef';

// URL pattern (simplified but covers common cases)
const URL_PATTERN = '(?:https?://|www\\.)[^\\s<>\"\'）】」》]+';

// CJK followed directly by URL (no space)
const CJK_THEN_URL_CHECK = new RegExp(`([${CJK}])(${URL_PATTERN})`, 'g');

// URL followed directly by CJK (no space)
const URL_THEN_CJK_CHECK = new RegExp(`(${URL_PATTERN})([${CJK}])`, 'g');

export const urlSpacing: Rule = {
  id: 'url-spacing',
  name: 'URL 前后空格',
  description: 'URL 链接与中文之间需要添加空格',
  severity: 'error',

  check(text: string): TextIssue[] {
    const issues: TextIssue[] = [];

    let regex = new RegExp(CJK_THEN_URL_CHECK.source, 'g');
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      issues.push({
        ruleId: this.id,
        message: 'URL 链接与中文之间缺少空格',
        original: match[0],
        replacement: match[1] + ' ' + match[2],
        offset: match.index,
        length: match[0].length,
      });
    }

    regex = new RegExp(URL_THEN_CJK_CHECK.source, 'g');
    while ((match = regex.exec(text)) !== null) {
      issues.push({
        ruleId: this.id,
        message: 'URL 链接与中文之间缺少空格',
        original: match[0],
        replacement: match[1] + ' ' + match[2],
        offset: match.index,
        length: match[0].length,
      });
    }

    return issues;
  },

  fix(text: string): string {
    let result = text;

    result = result.replace(
      new RegExp(CJK_THEN_URL_CHECK.source, 'g'),
      '$1 $2'
    );

    result = result.replace(
      new RegExp(URL_THEN_CJK_CHECK.source, 'g'),
      '$1 $2'
    );

    return result;
  },
};
