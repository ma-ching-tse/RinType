import type { Rule } from './interface';
import type { TextIssue } from '../types';

// Rule 4: Number + currency unit name needs a space (e.g., "100USD" → "100 USD")
const CURRENCY_UNITS = 'USD|EUR|GBP|JPY|CNY|KRW|HKD|TWD|SGD|AUD|CAD|CHF|USDT|USDC|BTC|ETH';
const NUM_THEN_CURRENCY = new RegExp(`(\\d)(${CURRENCY_UNITS})\\b`, 'g');

// Rule 5a: No space between number and % (e.g., "100 %" → "100%")
const NUM_SPACE_PERCENT = /(\d)\s+(%)/g;

// Rule 5b: No space between currency symbol and number (e.g., "$ 50" → "$50")
const SYMBOL_SPACE_NUM = /([$€£¥₩₽])\s+(\d)/g;

// Rule 6: Math/comparison symbols (≈ + -) must come BEFORE currency symbol, no spaces between
// Detects: currency symbol followed by math symbol (wrong order)
// e.g. "$+1.45" → "+$1.45", "$ +1.45" → "+$1.45", "$ ≈1.45" → "≈$1.45"
const CURRENCY_BEFORE_MATH = /([$€£¥₩₽])\s*([≈+\-])\s*(\d)/g;

export const numberSpacing: Rule = {
  id: 'number-spacing',
  name: '数字与货币/百分号间距',
  description: '数字与货币单位之间加空格；符号与货币符号之间不加空格；≈/+/- 应置于货币符号之前',
  severity: 'error',

  check(text: string): TextIssue[] {
    const issues: TextIssue[] = [];
    let regex: RegExp;
    let match: RegExpExecArray | null;

    // Rule 4: Missing space between number and currency unit
    regex = new RegExp(NUM_THEN_CURRENCY.source, 'g');
    while ((match = regex.exec(text)) !== null) {
      issues.push({
        ruleId: this.id,
        message: `数字与货币单位「${match[2]}」之间缺少空格`,
        original: match[0],
        replacement: match[1] + ' ' + match[2],
        offset: match.index,
        length: match[0].length,
      });
    }

    // Rule 5a: Unwanted space between number and %
    regex = new RegExp(NUM_SPACE_PERCENT.source, 'g');
    while ((match = regex.exec(text)) !== null) {
      issues.push({
        ruleId: this.id,
        message: `数字与百分号之间不应有空格`,
        original: match[0],
        replacement: match[1] + match[2],
        offset: match.index,
        length: match[0].length,
      });
    }

    // Rule 5b: Unwanted space between currency symbol and number
    regex = new RegExp(SYMBOL_SPACE_NUM.source, 'g');
    while ((match = regex.exec(text)) !== null) {
      issues.push({
        ruleId: this.id,
        message: `货币符号「${match[1]}」与数字之间不应有空格`,
        original: match[0],
        replacement: match[1] + match[2],
        offset: match.index,
        length: match[0].length,
      });
    }

    // Rule 6: Math symbol should come before currency symbol
    regex = new RegExp(CURRENCY_BEFORE_MATH.source, 'g');
    while ((match = regex.exec(text)) !== null) {
      const correct = match[2] + match[1] + match[3];
      issues.push({
        ruleId: this.id,
        message: `「${match[2]}」应置于货币符号「${match[1]}」之前，即「${correct}...」`,
        original: match[0],
        replacement: correct,
        offset: match.index,
        length: match[0].length,
      });
    }

    return issues;
  },

  fix(text: string): string {
    let result = text;

    // Fix Rule 6 first (reorder + remove spaces), before other spacing fixes
    result = result.replace(
      new RegExp(CURRENCY_BEFORE_MATH.source, 'g'),
      '$2$1$3'
    );

    // Add space between number and currency unit
    result = result.replace(
      new RegExp(NUM_THEN_CURRENCY.source, 'g'),
      '$1 $2'
    );

    // Remove space between number and %
    result = result.replace(
      new RegExp(NUM_SPACE_PERCENT.source, 'g'),
      '$1$2'
    );

    // Remove space between currency symbol and number
    result = result.replace(
      new RegExp(SYMBOL_SPACE_NUM.source, 'g'),
      '$1$2'
    );

    return result;
  },
};
