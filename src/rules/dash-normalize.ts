import type { Rule } from './interface';
import type { TextIssue } from '../types';

// CJK character range
const CJK = '\\u2e80-\\u2eff\\u2f00-\\u2fdf\\u3040-\\u309f\\u30a0-\\u30ff\\u3100-\\u312f\\u3200-\\u32ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff\\ufe30-\\ufe4f\\uff00-\\uffef';

// Pattern 1: Double hyphen "--" in CJK context → "——"
// CJK before or after --
const DOUBLE_HYPHEN_CJK = new RegExp(
  `([${CJK}])--([${CJK}])|([${CJK}])--(\\s)|^--(\\s*[${CJK}])|(\\s)--(\\s*[${CJK}])|([${CJK}])--$`,
  'g'
);

// Uses capturing groups instead of lookbehind for Figma sandbox compatibility
// CJK before -- with CJK or space after, OR space/CJK before -- with CJK after
const DOUBLE_HYPHEN_CHECK = new RegExp(
  `([${CJK}])--((?=[${CJK}\\s]))|([ \\t])--([${CJK}])`,
  'g'
);

// En dash (–) between CJK characters → "——"
const EN_DASH_CJK_CHECK = new RegExp(
  `([${CJK}])–([${CJK}])`,
  'g'
);

export const dashNormalize: Rule = {
  id: 'dash-normalize',
  name: '连字符与破折号',
  description: '区分连字符（-）、半角破折号（–）和全角破折号（——），中文语境中的破折号应使用「——」',
  severity: 'warning',

  check(text: string): TextIssue[] {
    const issues: TextIssue[] = [];

    let regex = new RegExp(DOUBLE_HYPHEN_CHECK.source, 'g');
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      // The -- starts after the captured prefix character
      const dashOffset = match[1] ? match.index + 1 : match.index + 1;
      issues.push({
        ruleId: this.id,
        message: '中文语境中应使用全角破折号「——」而非双连字符「--」',
        original: '--',
        replacement: '——',
        offset: dashOffset,
        length: 2,
      });
    }

    regex = new RegExp(EN_DASH_CJK_CHECK.source, 'g');
    while ((match = regex.exec(text)) !== null) {
      issues.push({
        ruleId: this.id,
        message: '中文语境中应使用全角破折号「——」而非半角破折号「–」',
        original: '–',
        replacement: '——',
        offset: match.index + 1, // after the captured CJK char
        length: 1,
      });
    }

    return issues;
  },

  fix(text: string): string {
    let result = text;

    // Replace double hyphen in CJK context
    result = result.replace(
      new RegExp(DOUBLE_HYPHEN_CHECK.source, 'g'),
      (_full, cjkBefore?: string, _after1?: string, spaceBefore?: string, cjkAfter?: string) => {
        if (cjkBefore) return cjkBefore + '——';
        if (spaceBefore && cjkAfter) return spaceBefore + '——' + cjkAfter;
        return _full;
      }
    );

    // Replace en dash between CJK
    result = result.replace(
      new RegExp(EN_DASH_CJK_CHECK.source, 'g'),
      '$1——$2'
    );

    return result;
  },
};
