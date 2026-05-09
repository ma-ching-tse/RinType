import type { Rule } from './interface';
import { trimWhitespace } from './trim-whitespace';
import { consecutiveSpaces } from './consecutive-spaces';
import { cjkSpacing } from './cjk-spacing';
import { fullwidthHalfwidth } from './fullwidth-halfwidth';
import { capitalization } from './capitalization';
import { punctuation } from './punctuation';
import { timeUnits } from './time-units';
import { quantityUnits } from './quantity-units';
import { separatorCapitalization } from './separator-capitalization';
import { numberSpacing } from './number-spacing';
import { thousandSeparator } from './thousand-separator';
import { sentenceCapitalization } from './sentence-capitalization';
import { dashNormalize } from './dash-normalize';
import { urlSpacing } from './url-spacing';
import { operatorSpacing } from './operator-spacing';

// Rules are executed in this order
export const allRules: Rule[] = [
  trimWhitespace,
  consecutiveSpaces,
  cjkSpacing,
  fullwidthHalfwidth,
  capitalization,
  punctuation,
  timeUnits,
  quantityUnits,
  separatorCapitalization,
  numberSpacing,
  thousandSeparator,
  sentenceCapitalization,
  dashNormalize,
  urlSpacing,
  operatorSpacing,
];

export const ruleMap = new Map<string, Rule>(
  allRules.map((r) => [r.id, r])
);
