import type { Rule } from './interface';
import type { TextIssue } from '../types';

// Half-width parens should have a space between the paren and an adjacent letter/digit/CJK
// on the outside (e.g. `Wallet(USDT)` → `Wallet (USDT)`). Full-width parens carry their
// own visual padding so they're not touched.
//
// To avoid conflicting with the punctuation rule (which converts `(中文)` → `（中文）`),
// a paren pair whose content contains CJK is skipped — the punctuation rule will rewrite
// it to full-width on its own pass.

const CJK_CHARS = '\\u2e80-\\u2eff\\u2f00-\\u2fdf\\u3040-\\u309f\\u30a0-\\u30ff\\u3100-\\u312f\\u3200-\\u32ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff';
const WORD_CHAR = new RegExp(`[A-Za-z0-9${CJK_CHARS}]`);
const CJK_RANGE = new RegExp(`[${CJK_CHARS}]`);

function pairParens(text: string): Map<number, number> {
  const pairs = new Map<number, number>();
  const stack: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') stack.push(i);
    else if (ch === ')') {
      const open = stack.pop();
      if (open !== undefined) {
        pairs.set(open, i);
        pairs.set(i, open);
      }
    }
  }
  return pairs;
}

function collectIssues(text: string): TextIssue[] {
  const issues: TextIssue[] = [];
  const pairs = pairParens(text);

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch !== '(' && ch !== ')') continue;

    const partner = pairs.get(i);
    if (partner === undefined) continue; // unmatched paren — leave alone

    const [openIdx, closeIdx] = i < partner ? [i, partner] : [partner, i];
    const inner = text.slice(openIdx + 1, closeIdx);
    if (CJK_RANGE.test(inner)) continue; // will be converted to full-width by punctuation rule

    if (ch === '(' && i > 0) {
      const prev = text[i - 1];
      if (WORD_CHAR.test(prev)) {
        issues.push({
          ruleId: 'paren-spacing',
          message: '括号「(」前需要空格',
          original: prev + '(',
          replacement: prev + ' (',
          offset: i - 1,
          length: 2,
        });
      }
    } else if (ch === ')' && i < text.length - 1) {
      const next = text[i + 1];
      if (WORD_CHAR.test(next)) {
        issues.push({
          ruleId: 'paren-spacing',
          message: '括号「)」后需要空格',
          original: ')' + next,
          replacement: ') ' + next,
          offset: i,
          length: 2,
        });
      }
    }
  }

  return issues;
}

export const parenSpacing: Rule = {
  id: 'paren-spacing',
  name: '括号外侧空格',
  description: '半角括号与相邻字母/数字/中文之间需要空格（全角括号自带间距）',
  severity: 'warning',

  check(text: string): TextIssue[] {
    return collectIssues(text);
  },

  fix(text: string): string {
    const issues = collectIssues(text);
    if (issues.length === 0) return text;
    // Apply right-to-left so earlier offsets remain valid as we splice in spaces.
    const sorted = [...issues].sort((a, b) => b.offset - a.offset);
    let result = text;
    for (const issue of sorted) {
      result = result.slice(0, issue.offset) + issue.replacement + result.slice(issue.offset + issue.length);
    }
    return result;
  },
};
