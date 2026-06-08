# RinType 使用统计

RinType 复用 **RinScanner 已有的那套后台**（同一个 ingest server、同一个
`events.jsonl`），不另起服务。事件里带 `product: "rintype"` 与 RinScanner 区分开。

## 架构

- **ingest server** —— 沿用 RinScanner 的 `server/index.js`。它的 `VALID_EVENTS`
  已包含 `scan` / `fix`，并原样透传多余字段（`product` / `byRule` / `count`），
  所以**收 RinType 的数据完全不用改**。
- **报表 CLI** —— 用本目录的 `rintype-report.js`，只读 `product==='rintype'` 的事件。

## 1. 让插件上报

插件已硬编码上报到 `src/code.ts` 里的 `TELEMETRY_URL`
（当前 = `https://47.79.20.248.sslip.io/telemetry`，和 RinScanner 同一台）。
换服务器就改这个常量，然后 `npm run build` 重新分发插件。

> 必须是 **HTTPS** —— Figma 在 HTTPS 下运行，会拦截插件发往 `http://` 的请求。

## 2. 看数据

把 `rintype-report.js` 放到服务器上、指向那份共用的 `events.jsonl`：

```bash
DATA=/path/to/events.jsonl node rintype-report.js            # 全部历史
DATA=/path/to/events.jsonl node rintype-report.js --days 7   # 最近 7 天
node server/rintype-report.js --since 24h                    # 最近 24 小时（30m/12h/7d）
node server/rintype-report.js --user 张三                    # 只看某人
node server/rintype-report.js --json                         # 原始聚合 JSON
```

本地也可以：`npm run telemetry:report`（默认读 `server/events.jsonl`，用 `DATA=` 覆盖）。

## ⚠️ RinScanner 那边需要同步改一处

RinScanner 原本的 `server/report.js` 读 `events.jsonl` 时**不分产品**。一旦 RinType
开始往同一个文件写，它会把 RinType 的事件算进 RinScanner 的统计里。已在其
`report.js` 的 load 之后加了产品过滤：只保留 `product==='rinscanner'` 或**没有
`product` 字段**（老数据）的事件。两个报表从此各算各的。

## 上报内容

```jsonc
// scan —— 只在用户手动点「扫描」时上报，selectionchange 触发的自动扫描不报
{ "event": "scan", "product": "rintype", "userId": "...", "userName": "张三",
  "fileName": "Finance-APP", "scanned": 120, "scope": "frame",
  "found": { "total": 18, "byRule": { "cjk-spacing": 10, "english-typos": 5 } } }
// fix —— fixKind 为 ruleId（单条修复）或 "all"（一键全部修复）；count 为修复的问题数
{ "event": "fix", "product": "rintype", "fixKind": "cjk-spacing", "count": 1 }
```

**只上报数字摘要和身份** —— 不含被扫描的文本、命中的字符串、替换后的内容。

## 隐私 / 合规

这是**记名**统计（带 Figma `userName` / `userId`），与 RinScanner 一致。上线前请
告知团队并取得认可。想要纯匿名：删掉 `src/telemetry/telemetry.ts` payload 里的
`userId` / `userName` 即可（保留 `installId` 仍能数使用量与修复率）。
