import type { Rule } from './interface';
import type { TextIssue } from '../types';

// Time units: only M (month) is uppercase, all others are lowercase
// Pattern: digit(s) followed by a time unit letter (case insensitive)
const TIME_UNITS: Record<string, string> = {
  y: 'y', // year
  M: 'M', // month (uppercase)
  d: 'd', // day
  h: 'h', // hour
  m: 'm', // minute
  s: 's', // second
};

// Match patterns like 3Y, 5D, 2H, 30S, 6m (digit + time unit letter)
// Uses capturing groups instead of lookbehind for Figma sandbox compatibility
const TIME_UNIT_PATTERN = /(\d)([YyDdHhSs])(?![A-Za-z])/g;

export const timeUnits: Rule = {
  id: 'time-units',
  name: '时间单位大小写',
  description: '时间单位除月（M）大写外，其余均小写（y/d/h/m/s）',
  severity: 'warning',

  check(text: string): TextIssue[] {
    const issues: TextIssue[] = [];

    const regex1 = new RegExp(TIME_UNIT_PATTERN.source, TIME_UNIT_PATTERN.flags);
    let match: RegExpExecArray | null;

    while ((match = regex1.exec(text)) !== null) {
      const found = match[2]; // the unit letter
      const correct = found.toLowerCase();
      if (found !== correct) {
        issues.push({
          ruleId: this.id,
          message: `时间单位「${found}」应为小写「${correct}」`,
          original: found,
          replacement: correct,
          offset: match.index + match[1].length,
          length: 1,
        });
      }
    }

    return issues;
  },

  fix(text: string): string {
    return text.replace(TIME_UNIT_PATTERN, (_full, digit: string, unit: string) =>
      digit + unit.toLowerCase()
    );
  },
};
