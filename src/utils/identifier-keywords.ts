// Keywords that indicate an adjacent number is an identifier (referral code, order ID,
// account number, etc.) and should NOT be formatted with thousand separators.
//
// Used in two contexts:
// 1. Same text node: keyword appears immediately before the number → see thousand-separator rule
// 2. Cross-node: sibling text node within the same container contains a keyword → see scanner

const ENGLISH_KEYWORDS = [
  'code', 'referral', 'invite', 'promo', 'redeem', 'coupon',
  'order', 'invoice', 'account', 'ticket', 'session',
  'user', 'customer', 'member',
  'hash', 'txid', 'tx', 'ref', 'id',
  'no\\.?', 'num\\.?', 'number',
];

// CJK identifier suffixes/words. `\b` doesn't help inside CJK; we rely on the fact that
// these characters tend to be unique enough not to collide with normal prose at the boundary.
const CHINESE_KEYWORDS = [
  '号码', '编号', '订单号', '订单',
  '邀请码', '推荐码', '优惠码', '兑换码',
  '账号', '账户', '用户名', '用户号', '会员号', '发票号',
  '验证码', '激活码',
  '码', '号',
];

const ENGLISH_ALT = ENGLISH_KEYWORDS.join('|');
const CHINESE_ALT = CHINESE_KEYWORDS.join('|');

// Pattern used by thousand-separator: keyword must appear at the END of the text-before-number,
// optionally followed by separators (`:`, `#`, `=`, `-`, spaces, fullwidth variants).
// `\b` ensures English keywords don't match inside longer words (e.g. "barcode" won't match `code`).
export const KEYWORD_BEFORE_NUMBER_PATTERN = new RegExp(
  `(?:\\b(?:${ENGLISH_ALT})\\b|(?:${CHINESE_ALT}))[\\s:：#＃=＝\\-—–]*$`,
  'i'
);

// Pattern used by scanner sibling search: keyword appears anywhere in the sibling text.
const KEYWORD_ANYWHERE_PATTERN = new RegExp(
  `(?:\\b(?:${ENGLISH_ALT})\\b|(?:${CHINESE_ALT}))`,
  'i'
);

export function containsIdentifierKeyword(text: string): boolean {
  return KEYWORD_ANYWHERE_PATTERN.test(text);
}
