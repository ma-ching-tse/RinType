# 词典贡献指南

本插件的两个词典 — **品牌术语**（`brand-terms`）和 **英文拼写错误**（`english-typos`）— 都是开放扩展的。
日常遇到写错的术语，欢迎随时补充。

---

## 添加品牌术语

适用场景：BitMart 产品名、子品牌、合作伙伴、币种代码、Web3 行业术语等有"官方写法"的词。

📁 编辑文件：[`src/rules/brand-terms.ts`](src/rules/brand-terms.ts)

在 `BRAND_TERMS` 字典里加一行：

```ts
'小写的错误写法': '正确写法',
```

### 示例

```ts
// 单一错写
'launchpad': 'Launchpad',

// 多个错写指向同一个正确写法（写多行即可）
'metamask': 'MetaMask',
'meta-mask': 'MetaMask',
'meta mask': 'MetaMask',  // 注意：含空格的写法不会被识别（按"词"拆分）
```

### 写入规则

1. **key 必须是全小写**（插件内部统一转小写后查表）
2. **value 是希望显示的最终写法**（保留大小写、连字符等格式）
3. **不要包含空格的 key** — 插件按词边界匹配，含空格的 key 实际匹配不到
4. **避免与英文常见词冲突** — 例如不要加 `'card': 'Card'`，会把所有 `card` 都标红

### 不要加哪些词

- ❌ 单字母 / 双字母缩写：`a`, `ai`（已经在主词典里）— 会跟句中正常单词冲突
- ❌ 任何在英文里有其他含义的常用词：`pay`, `box`, `pro`
- ❌ 有多种写法都被官方接受的：`Web 3` vs `Web3`（除非你们内部定了唯一标准）

---

## 添加英文错拼

适用场景：英文文案里出现的明确拼写错误。

📁 编辑文件：[`src/rules/english-typos.ts`](src/rules/english-typos.ts)

在 `TYPOS` 字典里加一行：

```ts
'错误拼写': '正确拼写',
```

### 黄金法则

**只加在英美拼写下都错的词。** 不确定就先不加。

✅ 安全：`recieve` → `receive`（英美都错）
✅ 安全：`occured` → `occurred`（英美都错）
❌ 危险：`organize` ↔ `organise`（美式 vs 英式，都对）
❌ 危险：`color` ↔ `colour`（同上）
❌ 危险：`gray` ↔ `grey`（同上）

不确定时，搜一下英国国家语料库或问 ChatGPT「Is X a valid British spelling?」

### 自动保留大小写

不需要为不同大小写写多条，插件会自动处理：

- `recieve` → `receive`
- `Recieve` → `Receive`
- `RECIEVE` → `RECEIVE`

---

## 测试

加完之后跑一下：

```bash
npm run build
```

build 通过就说明语法没问题。然后在 Figma 里重新加载插件，对一段含目标词的文字测试一下。

---

## 提交

### 如果你会用 Git

直接发 PR，标题用 `Add brand terms: X, Y, Z` 或 `Add typos: X, Y, Z` 即可。

### 不会用 Git 也没关系

把你想加的词列在群里或发给我，格式越简单越好，例如：

```
品牌术语：
- Launchpad（错写：launchpad / LaunchPad）
- Spot Trading（错写：spot trading / spot-trading）

英文错拼：
- accomodation → accommodation
- ocurred → occurred
```

我帮你加。

---

## 一些建议

- **小批量、频繁更新** 优于一次塞 100 个词。词典越大，潜在的误报点也越多。
- 加完一批后**先在自己常用的几个设计稿里试一遍**，确认没有误伤再合并。
- 遇到误报别忍着，告诉我，可能要把那个词从词典里移除或调整匹配规则。
