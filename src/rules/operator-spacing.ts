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
    return text.replace(regex, (_full, left, _sb, op, _sa, right) => {
      return left + ' ' + op + ' ' + right;
    });
  },
};
