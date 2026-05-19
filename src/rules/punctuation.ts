import type { Rule } from './interface';
import type { TextIssue } from '../types';

// CJK character ranges for context detection
const CJK_RANGE = /[\u2e80-\u2eff\u2f00-\u2fdf\u3040-\u309f\u30a0-\u30ff\u3100-\u312f\u3200-\u32ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const LATIN_RANGE = /[A-Za-z]/;

// Mapping: half-width (English) → full-width (Chinese) punctuation
const HALF_TO_FULL: Record<string, string> = {
  ',': '，',
  '.': '。',
  '!': '！',
  '?': '？',
  ';': '；',
  ':': '：',
  '(': '（',
  ')': '）',
};

const FULL_TO_HALF: Record<string, string> = {};
for (const [half, full] of Object.entries(HALF_TO_FULL)) {
  FULL_TO_HALF[full] = half;
}

// All punctuation we care about
const ALL_PUNCT = new RegExp(
  `[,\\.!?;:()，。！？；：（）]`,
  'g'
);

// Determine if a character is CJK
function isCJK(ch: string | undefined): boolean {
  return ch ? CJK_RANGE.test(ch) : false;
}

function isLatin(ch: string | undefined): boolean {
  return ch ? LATIN_RANGE.test(ch) : false;
}

const OPEN_PARENS = new Set(['(', '（']);
const CLOSE_PARENS = new Set([')', '）']);

// Pair up parens by simple stack matching. Returns a map from paren index to its partner's index.
function pairParens(text: string): Map<number, number> {
  const pairs = new Map<number, number>();
  const stack: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (OPEN_PARENS.has(ch)) {
      stack.push(i);
    } else if (CLOSE_PARENS.has(ch)) {
      const open = stack.pop();
      if (open !== undefined) {
        pairs.set(open, i);
        pairs.set(i, open);
      }
    }
  }
  return pairs;
}

// Decide paren style by what's inside the pair (not the outer context).
// Rationale: `中文 (USDT)` should keep half-width because the content is pure ASCII;
// fullwidth around English content looks unbalanced.
function getParenStyleByContent(text: string, openIdx: number, closeIdx: number): 'cjk' | 'latin' {
  const inner = text.slice(openIdx + 1, closeIdx);
  return CJK_RANGE.test(inner) ? 'cjk' : 'latin';
}

// Determine language context around a punctuation mark
// Look at surrounding characters to decide if this is Chinese or English context
function getContext(text: string, index: number): 'cjk' | 'latin' | 'unknown' {
  // Look backward for the nearest letter character
  let prevLang: 'cjk' | 'latin' | null = null;
  for (let i = index - 1; i >= 0 && i >= index - 20; i--) {
    if (isCJK(text[i])) { prevLang = 'cjk'; break; }
    if (isLatin(text[i])) { prevLang = 'latin'; break; }
  }

  // Look forward for the nearest letter character
  let nextLang: 'cjk' | 'latin' | null = null;
  for (let i = index + 1; i < text.length && i <= index + 20; i++) {
    if (isCJK(text[i])) { nextLang = 'cjk'; break; }
    if (isLatin(text[i])) { nextLang = 'latin'; break; }
  }

  // If both sides agree, use that
  if (prevLang === 'cjk' || nextLang === 'cjk') {
    if (prevLang !== 'latin' && nextLang !== 'latin') return 'cjk';
  }
  if (prevLang === 'latin' || nextLang === 'latin') {
    if (prevLang !== 'cjk' && nextLang !== 'cjk') return 'latin';
  }

  // Mixed context: prefer the preceding context
  if (prevLang) return prevLang;
  if (nextLang) return nextLang;

  return 'unknown';
}

export const punctuation: Rule = {
  id: 'punctuation',
  name: '标点符号',
  description: '中文语境使用中文标点，英文语境使用英文标点',
  severity: 'error',

  check(text: string): TextIssue[] {
    const issues: TextIssue[] = [];
    const regex = new RegExp(ALL_PUNCT.source, 'g');
    const parenPairs = pairParens(text);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const punct = match[0];
      const isParen = OPEN_PARENS.has(punct) || CLOSE_PARENS.has(punct);
      const partner = isParen ? parenPairs.get(match.index) : undefined;

      let ctx: 'cjk' | 'latin' | 'unknown';
      if (isParen && partner !== undefined) {
        const [openIdx, closeIdx] = match.index < partner
          ? [match.index, partner]
          : [partner, match.index];
        ctx = getParenStyleByContent(text, openIdx, closeIdx);
      } else {
        ctx = getContext(text, match.index);
      }

      if (ctx === 'cjk' && HALF_TO_FULL[punct]) {
        issues.push({
          ruleId: this.id,
          message: `中文语境中「${punct}」应使用「${HALF_TO_FULL[punct]}」`,
          original: punct,
          replacement: HALF_TO_FULL[punct],
          offset: match.index,
          length: 1,
        });
      } else if (ctx === 'latin' && FULL_TO_HALF[punct]) {
        issues.push({
          ruleId: this.id,
          message: `英文语境中「${punct}」应使用「${FULL_TO_HALF[punct]}」`,
          original: punct,
          replacement: FULL_TO_HALF[punct],
          offset: match.index,
          length: 1,
        });
      }
    }

    return issues;
  },

  fix(text: string): string {
    const regex = new RegExp(ALL_PUNCT.source, 'g');
    const parenPairs = pairParens(text);
    return text.replace(regex, (punct, offset) => {
      const isParen = OPEN_PARENS.has(punct) || CLOSE_PARENS.has(punct);
      const partner = isParen ? parenPairs.get(offset) : undefined;

      let ctx: 'cjk' | 'latin' | 'unknown';
      if (isParen && partner !== undefined) {
        const [openIdx, closeIdx] = offset < partner ? [offset, partner] : [partner, offset];
        ctx = getParenStyleByContent(text, openIdx, closeIdx);
      } else {
        ctx = getContext(text, offset);
      }

      if (ctx === 'cjk' && HALF_TO_FULL[punct]) return HALF_TO_FULL[punct];
      if (ctx === 'latin' && FULL_TO_HALF[punct]) return FULL_TO_HALF[punct];
      return punct;
    });
  },
};
