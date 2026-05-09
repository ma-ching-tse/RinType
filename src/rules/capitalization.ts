import type { Rule } from './interface';
import type { TextIssue } from '../types';

// Dictionary of proper nouns with correct capitalization
// Easily extensible: just add more entries
const PROPER_NOUNS: Record<string, string> = {
  'ios': 'iOS',
  'iphone': 'iPhone',
  'ipad': 'iPad',
  'imac': 'iMac',
  'macos': 'macOS',
  'ipados': 'iPadOS',
  'watchos': 'watchOS',
  'tvos': 'tvOS',
  'visionos': 'visionOS',
  'github': 'GitHub',
  'gitlab': 'GitLab',
  'javascript': 'JavaScript',
  'typescript': 'TypeScript',
  'nodejs': 'Node.js',
  'node.js': 'Node.js',
  'vuejs': 'Vue.js',
  'vue.js': 'Vue.js',
  'reactjs': 'ReactJS',
  'nextjs': 'Next.js',
  'next.js': 'Next.js',
  'nuxtjs': 'Nuxt.js',
  'nuxt.js': 'Nuxt.js',
  'webpack': 'webpack',
  'youtube': 'YouTube',
  'linkedin': 'LinkedIn',
  'wechat': 'WeChat',
  'alipay': 'Alipay',
  'figma': 'Figma',
  'photoshop': 'Photoshop',
  'illustrator': 'Illustrator',
  'sketch': 'Sketch',
  'android': 'Android',
  'windows': 'Windows',
  'linux': 'Linux',
  'ubuntu': 'Ubuntu',
  'mysql': 'MySQL',
  'postgresql': 'PostgreSQL',
  'mongodb': 'MongoDB',
  'redis': 'Redis',
  'docker': 'Docker',
  'kubernetes': 'Kubernetes',
  'wifi': 'Wi-Fi',
  'bluetooth': 'Bluetooth',
  'usb': 'USB',
  'api': 'API',
  'url': 'URL',
  'html': 'HTML',
  'css': 'CSS',
  'json': 'JSON',
  'xml': 'XML',
  'http': 'HTTP',
  'https': 'HTTPS',
  'sdk': 'SDK',
  'ui': 'UI',
  'ux': 'UX',
  'ai': 'AI',
  'bitmart': 'BitMart',
};

// Build a regex that matches any proper noun at word boundaries (case insensitive)
// Sort by length descending so longer matches take priority
// Uses capturing group instead of lookbehind for Figma sandbox compatibility
const sortedKeys = Object.keys(PROPER_NOUNS).sort((a, b) => b.length - a.length);
const BOUNDARY = `[\\s，。！？、；：""''（）\\[\\]{}.,!?;:\\'\"()\\-/]`;
const PATTERN = new RegExp(
  `(?:^|${BOUNDARY})(${sortedKeys.map(escapeRegex).join('|')})(?=$|${BOUNDARY})`,
  'gi'
);

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Check if the matched word is part of a domain name or email address
function isInDomainOrEmail(text: string, matchIndex: number, matchLength: number): boolean {
  const before = text.slice(0, matchIndex);
  const after = text.slice(matchIndex + matchLength);

  // Part of a domain: word followed by .com/.xyz/.io etc.
  if (/^\.[a-z]{2,}(\b|$)/i.test(after)) return true;

  // Part of a domain: preceded by a dot and possibly more domain parts (e.g., "www.bitmart")
  if (/[a-z0-9]\.$/.test(before)) return true;

  // Part of an email: preceded by @ or @something.
  if (/@[a-z0-9.-]*$/i.test(before)) return true;

  // Part of an email: before the @
  if (/^[a-z0-9.-]*@/i.test(after)) return true;

  return false;
}

export const capitalization: Rule = {
  id: 'capitalization',
  name: '专有名词大小写',
  description: '专有名词应使用正确的大小写拼写',
  severity: 'warning',

  check(text: string): TextIssue[] {
    const issues: TextIssue[] = [];
    const regex = new RegExp(PATTERN.source, PATTERN.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const found = match[1]; // captured group (the word itself)
      const wordOffset = match.index + match[0].length - found.length;
      const correct = PROPER_NOUNS[found.toLowerCase()];

      if (correct && found !== correct && !isInDomainOrEmail(text, wordOffset, found.length)) {
        issues.push({
          ruleId: this.id,
          message: `「${found}」应为「${correct}」`,
          original: found,
          replacement: correct,
          offset: wordOffset,
          length: found.length,
        });
      }
    }

    return issues;
  },

  fix(text: string): string {
    const regex = new RegExp(PATTERN.source, PATTERN.flags);
    return text.replace(regex, (fullMatch, word: string, offset: number) => {
      const wordOffset = offset + fullMatch.length - word.length;
      const correct = PROPER_NOUNS[word.toLowerCase()];
      if (correct && word !== correct && !isInDomainOrEmail(text, wordOffset, word.length)) {
        return fullMatch.slice(0, fullMatch.length - word.length) + correct;
      }
      return fullMatch;
    });
  },
};
