import type { Rule } from './interface';
import type { TextIssue } from '../types';

function addThousandSeparator(numStr: string): string {
  const parts = numStr.split('.');
  const intPart = parts[0];
  const decPart = parts.length > 1 ? '.' + parts[1] : '';
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return formatted + decPart;
}

// Find numbers >= 4 digits without existing commas
// Uses non-capturing prefix instead of lookbehind for Figma compatibility
const NUMBER_PATTERN = /(?:[^.,\w#]|^)(\d{4,})(?![.,\d\w/\-])/g;

// Check if a number at the given position is a year/date and should be skipped
function isYearOrDate(text: string, matchIndex: number, num: string): boolean {
  const afterNum = text.slice(matchIndex + num.length);

  // 4-digit number followed by 年、年度、月、日
  if (num.length === 4 && /^[年月日]/.test(afterNum)) return true;

  // 4-digit number followed by date separators: /MM/DD, -MM-DD, .MM.DD
  if (num.length === 4 && /^[/\-.]\d{1,2}[/\-.]\d{1,2}/.test(afterNum)) return true;

  // Number preceded by date context (月、日、年 immediately before)
  const beforeNum = text.slice(0, matchIndex);
  if (/[年月日/\-.]$/.test(beforeNum) && num.length <= 4) return true;

  return false;
}

// Identifier keywords (English + Chinese). When one of these appears immediately before
// the number (optionally separated by `:` `#` `=` `-` or spaces), the number is treated
// as an identifier (referral code / order ID / account number / ...) and not formatted.
const IDENTIFIER_PATTERN =
  /(?:code|referral|invite|promo|redeem|coupon|order|invoice|account|ticket|session|user|customer|member|hash|txid|tx|ref|id|no\.?|num\.?|number|号码|编号|订单号|订单|邀请码|推荐码|优惠码|兑换码|账号|账户|账户号|用户名|用户号|会员号|发票号|验证码|激活码|码|号)[\s:：#＃=＝\-—–]*$/i;

function isIdentifier(text: string, matchIndex: number): boolean {
  const before = text.slice(Math.max(0, matchIndex - 24), matchIndex);
  return IDENTIFIER_PATTERN.test(before);
}

export const thousandSeparator: Rule = {
  id: 'thousand-separator',
  name: '千分符',
  description: '为四位及以上数字添加千分符（年份和日期除外）',
  severity: 'warning',

  check(text: string): TextIssue[] {
    const issues: TextIssue[] = [];
    const regex = new RegExp(NUMBER_PATTERN.source, NUMBER_PATTERN.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const num = match[1];
      // Calculate the actual offset of the digit sequence
      const numOffset = match.index + match[0].length - num.length;

      if (isYearOrDate(text, numOffset, num)) continue;
      if (isIdentifier(text, numOffset)) continue;

      const formatted = addThousandSeparator(num);
      if (formatted !== num) {
        issues.push({
          ruleId: this.id,
          message: `「${num}」建议添加千分符「${formatted}」`,
          original: num,
          replacement: formatted,
          offset: numOffset,
          length: num.length,
        });
      }
    }

    return issues;
  },

  fix(text: string): string {
    const regex = new RegExp(NUMBER_PATTERN.source, NUMBER_PATTERN.flags);
    return text.replace(regex, (fullMatch) => {
      // Extract the prefix (non-digit part) and the number
      const prefixMatch = fullMatch.match(/^(\D*)/);
      const prefix = prefixMatch ? prefixMatch[1] : '';
      const num = fullMatch.slice(prefix.length);

      // Find position in original text for year check
      const idx = text.indexOf(fullMatch);
      const numOffset = idx + prefix.length;

      if (isYearOrDate(text, numOffset, num)) return fullMatch;
      if (isIdentifier(text, numOffset)) return fullMatch;

      return prefix + addThousandSeparator(num);
    });
  },
};
