#!/usr/bin/env node
// RinType 使用统计 — 命令行文本报表（零依赖）。
//
// RinType 和 RinScanner 共用同一个 ingest server / events.jsonl。本脚本只读取
// product === 'rintype' 的事件，所以可以和 RinScanner 的 report.js 放在同一台
// 服务器、指向同一个 events.jsonl，互不干扰。
//
//   node server/rintype-report.js                # 全部历史
//   node server/rintype-report.js --days 7       # 最近 7 天
//   node server/rintype-report.js --since 24h    # 最近 24 小时（支持 30m / 12h / 7d）
//   node server/rintype-report.js --user 张三    # 只看某人（按名字模糊匹配）
//   node server/rintype-report.js --json         # 输出原始聚合 JSON（给脚本用）
//
// 数据来源：共用的 events.jsonl。默认找 RinScanner ingest server 旁边的那个文件，
// 或用 DATA=/path/to/events.jsonl 指定。

const fs = require('fs');
const path = require('path');

// 默认指向共用的 events.jsonl。部署时通常 DATA=/path/to/events.jsonl 显式指定。
const DATA_FILE = process.env.DATA || path.join(__dirname, 'events.jsonl');

// ruleId -> 中文名（与 src/rules 保持一致，仅用于报表可读性）。
const RULE_NAMES = {
  'trim-whitespace': '首尾空白',
  'consecutive-spaces': '连续空格',
  'cjk-spacing': '中英文间距',
  'fullwidth-halfwidth': '全角/半角',
  capitalization: '专有名词大小写',
  punctuation: '标点符号',
  'paren-spacing': '括号外侧空格',
  'time-units': '时间单位大小写',
  'quantity-units': '计量单位大小写',
  'separator-capitalization': '分割线首字母大写',
  'number-spacing': '数字与货币/百分号间距',
  'thousand-separator': '千分符',
  'sentence-capitalization': '英文句首大写',
  'dash-normalize': '连字符与破折号',
  'url-spacing': 'URL 前后空格',
  'operator-spacing': '运算符间距',
  'brand-terms': '品牌术语',
  'english-typos': '英文拼写错误',
  all: '全部修复',
};
const ruleName = (id) => RULE_NAMES[id] || id;

// ---- args -----------------------------------------------------------------
const argv = process.argv.slice(2);
function flag(name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}
const opts = {
  days: flag('--days') ? Number(flag('--days')) : undefined,
  since: flag('--since'),
  user: flag('--user'),
  json: argv.includes('--json'),
};

function sinceMs(spec) {
  if (!spec) return undefined;
  const m = /^(\d+)([mhd])$/.exec(spec.trim());
  if (!m) return undefined;
  const n = Number(m[1]);
  const unit = { m: 60e3, h: 3600e3, d: 86400e3 }[m[2]];
  return Date.now() - n * unit;
}

// ---- load + filter --------------------------------------------------------
function load() {
  if (!fs.existsSync(DATA_FILE)) return [];
  return fs
    .readFileSync(DATA_FILE, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

let events = load().filter((e) => e.product === 'rintype'); // 只看 RinType

let cutoff = sinceMs(opts.since);
if (cutoff === undefined && opts.days) cutoff = Date.now() - opts.days * 86400e3;
if (cutoff !== undefined) {
  events = events.filter((e) => e.receivedAt && Date.parse(e.receivedAt) >= cutoff);
}
if (opts.user) {
  const q = opts.user.toLowerCase();
  events = events.filter((e) => (e.userName || '').toLowerCase().includes(q));
}

// ---- aggregate ------------------------------------------------------------
function aggregate(evs) {
  const users = new Map();
  const files = new Map();
  const fixKinds = new Map(); // ruleId -> 修复次数(按 count 累加)
  const foundByRule = new Map(); // ruleId -> 累计发现数
  let scans = 0;
  let fixes = 0; // 累计修复的问题数(按 count)
  let foundTotal = 0;
  let firstSeen = null;
  let lastSeen = null;

  for (const e of evs) {
    const seen = e.receivedAt || null;
    if (seen) {
      if (!firstSeen || seen < firstSeen) firstSeen = seen;
      if (!lastSeen || seen > lastSeen) lastSeen = seen;
    }
    const key = e.userId || e.installId || 'unknown';
    if (!users.has(key)) {
      users.set(key, { name: e.userName || '(未识别)', scans: 0, found: 0, fixes: 0, lastSeen: null });
    }
    const u = users.get(key);
    if (e.userName) u.name = e.userName;
    if (seen && (!u.lastSeen || seen > u.lastSeen)) u.lastSeen = seen;

    if (e.event === 'scan') {
      scans++;
      u.scans++;
      const found = e.found?.total || 0;
      foundTotal += found;
      u.found += found;
      const byRule = e.found?.byRule || {};
      for (const [rid, n] of Object.entries(byRule)) {
        foundByRule.set(rid, (foundByRule.get(rid) || 0) + n);
      }
      const fkey = e.fileKey || e.fileName;
      if (fkey) {
        if (!files.has(fkey)) files.set(fkey, { name: e.fileName || fkey, scans: 0, found: 0 });
        const f = files.get(fkey);
        f.scans++;
        f.found += found;
      }
    } else if (e.event === 'fix') {
      const n = e.count || 1;
      fixes += n;
      u.fixes += n;
      const k = e.fixKind || 'unknown';
      fixKinds.set(k, (fixKinds.get(k) || 0) + n);
    }
  }

  return {
    period: { firstSeen, lastSeen, events: evs.length },
    totals: {
      uniqueUsers: users.size,
      scans,
      foundTotal,
      fixes,
      fixRate: foundTotal > 0 ? Math.round((fixes / foundTotal) * 100) : 0,
    },
    users: [...users.values()].sort((a, b) => b.scans - a.scans),
    files: [...files.values()].sort((a, b) => b.scans - a.scans).slice(0, 15),
    fixKinds: [...fixKinds.entries()].sort((a, b) => b[1] - a[1]),
    foundByRule: [...foundByRule.entries()].sort((a, b) => b[1] - a[1]),
    recent: evs.slice(-20).reverse(),
  };
}

const data = aggregate(events);

if (opts.json) {
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}

// ---- text rendering -------------------------------------------------------
// CJK chars take 2 terminal cells; pad accordingly so columns line up.
function width(s) {
  let w = 0;
  for (const ch of String(s)) w += ch.charCodeAt(0) > 0x2e7f ? 2 : 1;
  return w;
}
function pad(s, n) {
  s = String(s);
  const gap = n - width(s);
  return gap > 0 ? s + ' '.repeat(gap) : s;
}
function padNum(s, n) {
  s = String(s);
  const gap = n - width(s);
  return gap > 0 ? ' '.repeat(gap) + s : s;
}
function fmt(iso) {
  // Stored as UTC; display in Beijing time (UTC+8).
  if (!iso) return '—';
  const d = new Date(Date.parse(iso) + 8 * 3600e3);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
function line(ch = '─', n = 64) {
  return ch.repeat(n);
}

const out = [];
const T = data.totals;

let scope = '全部历史';
if (opts.since) scope = `最近 ${opts.since}`;
else if (opts.days) scope = `最近 ${opts.days} 天`;
if (opts.user) scope += ` · 用户「${opts.user}」`;

out.push('');
out.push(`RinType 使用统计   ·   ${scope}`);
if (data.period.firstSeen) out.push(`数据范围: ${fmt(data.period.firstSeen)} ~ ${fmt(data.period.lastSeen)}`);
out.push(line('═'));

if (data.period.events === 0) {
  out.push('该范围内没有数据。');
  out.push('（确认插件 TELEMETRY_URL 指向 /telemetry、ingest server 在跑，且事件带 product:"rintype"）');
  out.push('');
  console.log(out.join('\n'));
  process.exit(0);
}

out.push(
  `总览   使用人数 ${T.uniqueUsers} · 扫描 ${T.scans} 次 · 发现问题 ${T.foundTotal} · ` +
    `修复 ${T.fixes} 处 · 修复率 ${T.fixRate}%`,
);
out.push('');

// --- per user ---
out.push(`按人 (${data.users.length})`);
out.push('  ' + pad('用户', 14) + padNum('扫描', 6) + padNum('发现', 6) + padNum('修复', 6) + '  最近使用');
for (const u of data.users) {
  out.push(
    '  ' +
      pad(u.name, 14) +
      padNum(u.scans, 6) +
      padNum(u.found, 6) +
      padNum(u.fixes, 6) +
      '  ' +
      fmt(u.lastSeen),
  );
}
out.push('');

// --- per file ---
if (data.files.length) {
  out.push(`按文件 (Top ${data.files.length})`);
  out.push('  ' + pad('文件', 28) + padNum('扫描', 6) + padNum('发现', 8));
  for (const f of data.files) {
    out.push('  ' + pad(f.name, 28) + padNum(f.scans, 6) + padNum(f.found, 8));
  }
  out.push('');
}

// --- found by rule (天然的团队“常犯错误”清单) ---
if (data.foundByRule.length) {
  out.push('发现问题分布（按规则）');
  for (const [rid, n] of data.foundByRule) out.push('  ' + pad(ruleName(rid), 22) + padNum(n, 6));
  out.push('');
}

// --- fix kinds ---
if (data.fixKinds.length) {
  out.push('修复分布（按规则 / all=一键全部修复）');
  for (const [k, n] of data.fixKinds) out.push('  ' + pad(ruleName(k), 22) + padNum(n, 6));
  out.push('');
}

// --- recent ---
out.push('最近事件');
for (const e of data.recent) {
  let detail = '';
  if (e.event === 'scan') detail = `${e.found?.total ?? 0} 问题 / ${e.scanned} 节点 · ${e.scope || ''}`;
  else if (e.event === 'fix') detail = `${ruleName(e.fixKind)} × ${e.count ?? 1}`;
  out.push('  ' + pad(fmt(e.receivedAt), 13) + pad(e.userName || '—', 12) + pad(e.event, 8) + detail);
}
out.push('');

console.log(out.join('\n'));
