import type { Rule } from './interface';
import type { TextIssue } from '../types';

// BitMart-specific brand terms, crypto tickers, and Web3 vocabulary that have a single
// canonical capitalization. Distinct from `capitalization` (general tech proper nouns)
// because brand consistency is treated as an error, not a warning.
//
// Team review encouraged — add product names, campaign names, and partner brands here.
const BRAND_TERMS: Record<string, string> = {
  // Company & product
  'bitmart': 'BitMart',

  // Crypto tickers (uppercase canonical)
  'btc': 'BTC',
  'eth': 'ETH',
  'bnb': 'BNB',
  'sol': 'SOL',
  'usdt': 'USDT',
  'usdc': 'USDC',
  'busd': 'BUSD',
  'dai': 'DAI',
  'xrp': 'XRP',
  'ada': 'ADA',
  'dot': 'DOT',
  'doge': 'DOGE',
  'shib': 'SHIB',
  'avax': 'AVAX',
  'matic': 'MATIC',
  'link': 'LINK',
  'uni': 'UNI',
  'ltc': 'LTC',
  'bch': 'BCH',
  'trx': 'TRX',

  // Web3 / industry terms (mixed-case canonical)
  'defi': 'DeFi',
  'cefi': 'CeFi',
  'gamefi': 'GameFi',
  'socialfi': 'SocialFi',
  'nft': 'NFT',
  'web3': 'Web3',
  'web2': 'Web2',
  'dao': 'DAO',
  'dapp': 'DApp',
  'dex': 'DEX',
  'cex': 'CEX',
  'amm': 'AMM',
  'tvl': 'TVL',
  'apy': 'APY',
  'apr': 'APR',
  'roi': 'ROI',
  'pnl': 'PnL',
  'p&l': 'PnL',
  'ido': 'IDO',
  'ico': 'ICO',
  'ieo': 'IEO',
  'ipo': 'IPO',
  'kyc': 'KYC',
  'aml': 'AML',
  'cbdc': 'CBDC',
  'p2p': 'P2P',
  'pow': 'PoW',
  'pos': 'PoS',
  'l1': 'L1',
  'l2': 'L2',

  // Project / chain / wallet names (commonly mis-cased)
  'metamask': 'MetaMask',
  'trustwallet': 'Trust Wallet',
  'walletconnect': 'WalletConnect',
  'opensea': 'OpenSea',
  'pancakeswap': 'PancakeSwap',
  'uniswap': 'Uniswap',
  'sushiswap': 'SushiSwap',
  'coinbase': 'Coinbase',
  'binance': 'Binance',
  'kraken': 'Kraken',
  'okx': 'OKX',
  'bybit': 'Bybit',
  'kucoin': 'KuCoin',
  'huobi': 'Huobi',
  'gate': 'Gate',
  'bitcoin': 'Bitcoin',
  'ethereum': 'Ethereum',
  'solana': 'Solana',
  'cardano': 'Cardano',
  'polkadot': 'Polkadot',
  'polygon': 'Polygon',
  'arbitrum': 'Arbitrum',
  'optimism': 'Optimism',
  'avalanche': 'Avalanche',
  'fantom': 'Fantom',
  'cosmos': 'Cosmos',
  'tron': 'TRON',
  'bsc': 'BSC',
  'ton': 'TON',
};

const sortedKeys = Object.keys(BRAND_TERMS).sort((a, b) => b.length - a.length);
const BOUNDARY = `[\\s，。！？、；：""''（）\\[\\]{}.,!?;:\\'\"()\\-/]`;
const PATTERN = new RegExp(
  `(?:^|${BOUNDARY})(${sortedKeys.map(escapeRegex).join('|')})(?=$|${BOUNDARY})`,
  'gi'
);

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Skip matches inside a domain or email (e.g. `bitmart.com`, `support@bitmart.com`).
function isInDomainOrEmail(text: string, matchIndex: number, matchLength: number): boolean {
  const before = text.slice(0, matchIndex);
  const after = text.slice(matchIndex + matchLength);
  if (/^\.[a-z]{2,}(\b|$)/i.test(after)) return true;
  if (/[a-z0-9]\.$/.test(before)) return true;
  if (/@[a-z0-9.-]*$/i.test(before)) return true;
  if (/^[a-z0-9.-]*@/i.test(after)) return true;
  return false;
}

export const brandTerms: Rule = {
  id: 'brand-terms',
  name: '品牌术语',
  description: 'BitMart 品牌、币种代码、Web3 术语应使用官方写法',
  severity: 'error',

  check(text: string): TextIssue[] {
    const issues: TextIssue[] = [];
    const regex = new RegExp(PATTERN.source, PATTERN.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const found = match[1];
      const wordOffset = match.index + match[0].length - found.length;
      const correct = BRAND_TERMS[found.toLowerCase()];

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
      const correct = BRAND_TERMS[word.toLowerCase()];
      if (correct && word !== correct && !isInDomainOrEmail(text, wordOffset, word.length)) {
        return fullMatch.slice(0, fullMatch.length - word.length) + correct;
      }
      return fullMatch;
    });
  },
};
