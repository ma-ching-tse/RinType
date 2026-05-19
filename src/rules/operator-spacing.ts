import type { Rule } from './interface';
import type { TextIssue } from '../types';

// Characters that indicate a "value" on the left side of an operator
const LEFT_VALUE = '[\\d%$€£¥₩₽\\)]';
// Characters that indicate a "value" on the right side of an operator
const RIGHT_VALUE = '[\\d$€£¥₩₽(]';

// ×, ÷, =, ≈ — always operators, never signs
// +, - — operators only when preceded by a value (digit/% /currency)
// Pattern: (left_char)(space_before)(operator)(space_after)(right_char)
const OP_PATTERN = new RegExp(
  `(${LEFT_VALUE})(\\s*)([×÷=≈+\\-])(\\s*)(${RIGHT_VALUE})`,
  'g'
);

function needsFix(spaceBefore: string, spaceAfter: string): boolean {
  return spaceBefore !== ' ' || spaceAfter !== ' ';
}

// If a `-` sits inside a digits-and-dashes sequence shaped like a date (or numeric range),
// skip it — it's a separator, not a subtraction operator.
// Matches: `2016-01-01`, `2016-01`, `01-01`, `2020-2024`, etc.
function isDateLikeDash(text: string, opIndex: number): boolean {
  if (text[opIndex] !== '-') return false;

  let start = opIndex;
  while (start > 0 && /[\d-]/.test(text[start - 1])) start--;
  let end = opIndex + 1;
  while (end < text.length && /[\d-]/.test(text[end])) end++;

  const sequence = text.slice(start, end);
  return /^\d{1,4}(?:-\d{1,4})+$/.test(sequence);
}

export const operatorSpacing: Rule = {
  id: 'operator-spacing',
  name: '运算符间距',
  description: '运算符（+ - × ÷ = ≈）作为运算符时两侧需要空格，作为正负符号时不加空格',
  severity: 'error',

  check(text: string): TextIssue[] {
    const issues: TextIssue[] = [];
    const regex = new RegExp(OP_PATTERN.source, OP_PATTERN.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const [full, left, spaceBefore, op, spaceAfter, right] = match;

      // Position of the operator character within the full text
      const opIndex = match.index + left.length + spaceBefore.length;
      if (isDateLikeDash(text, opIndex)) continue;

      if (needsFix(spaceBefore, spaceAfter)) {
        const correct = left + ' ' + op + ' ' + right;
        issues.push({
          ruleId: this.id,
          message: `运算符「${op}」两侧需要空格`,
          original: full,
          replacement: correct,
          offset: match.index,
          length: full.length,
        });
      }
    }

    return issues;
  },

  fix(text: string): string {
    const regex = new RegExp(OP_PATTERN.source, OP_PATTERN.flags);
    return text.replace(regex, (full, left, sb, op, sa, right, offset) => {
      const opIndex = offset + left.length + sb.length;
      if (isDateLikeDash(text, opIndex)) return full;
      return left + ' ' + op + ' ' + right;
    });
  },
};
