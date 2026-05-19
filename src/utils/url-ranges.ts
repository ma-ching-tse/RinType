// Shared URL detection — used to skip rules inside URLs (capitalization, spacing, etc.)
// since URLs are case- and character-sensitive and rewriting them would break the link.

// `https?://` allows zero trailing chars so a stray `http://` (even followed by a space) is still
// treated as a URL fragment and protected. `www.` still requires at least one char to avoid
// matching standalone `www.` text that isn't a URL.
export const URL_REGEX = /(?:https?:\/\/[^\s<>"'）】」》]*|www\.[^\s<>"'）】」》]+)/g;

export type Range = [number, number]; // [start, endExclusive]

export function getUrlRanges(text: string): Range[] {
  const ranges: Range[] = [];
  const re = new RegExp(URL_REGEX.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    ranges.push([m.index, m.index + m[0].length]);
  }
  return ranges;
}

export function overlapsAny(start: number, end: number, ranges: Range[]): boolean {
  for (const [s, e] of ranges) {
    if (start < e && end > s) return true;
  }
  return false;
}

// Run `fixFn` only on text segments outside URLs; URLs are preserved verbatim.
export function fixOutsideUrls(text: string, fixFn: (s: string) => string): string {
  const ranges = getUrlRanges(text);
  if (ranges.length === 0) return fixFn(text);

  let result = '';
  let cursor = 0;
  for (const [start, end] of ranges) {
    result += fixFn(text.slice(cursor, start));
    result += text.slice(start, end);
    cursor = end;
  }
  result += fixFn(text.slice(cursor));
  return result;
}
