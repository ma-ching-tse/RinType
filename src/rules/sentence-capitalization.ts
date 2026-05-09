import type { Rule } from './interface';
import type { TextIssue } from '../types';

// Known special words that should NOT be capitalized
const SPECIAL_WORDS = new Set([
  'iPhone', 'iPad', 'iPod', 'iOS', 'iMac', 'iCloud',
  'macOS', 'tvOS', 'watchOS', 'visionOS',
  'eBay', 'eBook',
]);

// Build a lowercase lookup for quick matching
const SPECIAL_WORDS_LOWER = new Map<string, string>();
for (const word of SPECIAL_WORDS) {
  SPECIAL_WORDS_LOWER.set(word.toLowerCase(), word);
}

// Sentence boundary pattern:
// - beginning of string
// - after . ! ? followed by one or more spaces
// - after Chinese sentence-ending punctuation 。！？
const SENTENCE_START = /(?:^|[.!?]\s+|[。！？])\s*([a-z])/g;

export const sentenceCapitalization: Rule = {
  id: 'sentence-capitalization',
  name: '英文句首大写',
  description: '独立英文句子首字母应大写',
  severity: 'warning',

  check(text: string): TextIssue[] {
    const issues: TextIssue[] = [];

    const regex = new RegExp(SENTENCE_START.source, 'g');
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const charOffset = match.index + match[0].length - 1;
      const lowercaseChar = match[1];

      // Extract the word starting at this position to check if it's a special word
      const wordMatch = text.slice(charOffset).match(/^[a-zA-Z]+/);
      if (wordMatch) {
        const word = wordMatch[0];
        const fullLower = (lowercaseChar + word.slice(1)).toLowerCase();
        if (SPECIAL_WORDS_LOWER.has(fullLower)) {
          continue; // skip special words like iPhone, macOS
        }
      }

      issues.push({
        ruleId: this.id,
        message: '英文句首字母应大写',
        original: lowercaseChar,
        replacement: lowercaseChar.toUpperCase(),
        offset: charOffset,
        length: 1,
      });
    }

    return issues;
  },

  fix(text: string): string {
    const regex = new RegExp(SENTENCE_START.source, 'g');

    return text.replace(regex, (fullMatch, char: string) => {
      const matchStart = fullMatch.length - 1;
      // Find position in original text to extract full word — use prefix
      const prefix = fullMatch.slice(0, matchStart);

      // We need to check the word in context; extract from replacement position
      // Since we only have the match, we check if the char starts a special word
      // by looking at the text after the match
      // For fix, we use a simpler approach: replace char, then re-scan for special words
      const upper = prefix + char.toUpperCase();
      return upper;
    }).replace(
      // Post-pass: revert any special words that got wrongly capitalized
      // e.g., "IPhone" back to "iPhone"
      new RegExp(`(?:^|[.!?]\\s+|[。！？])\\s*([A-Z][a-zA-Z]*)`, 'g'),
      (fullMatch, word: string) => {
        const lower = word.toLowerCase();
        if (SPECIAL_WORDS_LOWER.has(lower)) {
          const special = SPECIAL_WORDS_LOWER.get(lower)!;
          return fullMatch.slice(0, fullMatch.length - word.length) + special;
        }
        return fullMatch;
      }
    );
  },
};
