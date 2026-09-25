# 第三方数据接入指南（Third-Party Data Push）

> 面向**第三方采集项目 / 自动化脚本 / 其它 AI Agent**：如何把短视频等数据推送到本仓库（HubLinks 内容聚合站）。
> 本文是「数据接入」的**事实来源**。站内其它文案、schema、采集脚本都以它为准。

---

## 1. 本项目是什么（让第三方 / AI 先读懂）

HubLinks 是一个面向海外用户的**内容发现与导流站**，聚合三类内容：

| 类型 | 内容 | 平台举例 |
|---|---|---|
| `videos` 短视频 | 抖音 / TikTok 等短视频 | 抖音、TikTok |
| `comics` 漫画 | 正版漫画榜单作品 | Webtoon、Tapas、腾讯动漫、快看、漫客栈 |
| `novels` 小说 | 正版小说榜单作品 | Webnovel、Wattpad、Wuxiaworld、番茄小说、RoyalRoad、小说会 |

**核心机制**：本站**不抓取、不转码、不托管正版内容本身**。读者点击卡片后，通过一条跳转链接（Cloudflare Pages 真实 302）到达原站观看 / 阅读。详情页是 `noindex` 的纯跳转页。

> ⚠️ **唯一的存储例外：短视频封面（cover）**
> 短视频平台（抖音 / TikTok）的封面图普遍带**防盗链（Referer 校验）**，且原始链接有效期短、经常失效。如果像漫画/小说那样只存外链，卡片几乎必然裂图。
> 因此本站**对短视频封面做存储**，存储后端**自动降级**：
> - **配了 Cloudflare R2**（环境变量 `R2_*` 齐全）→ 封面上 R2 对象存储，仓库只记录 R2 公开 URL；
> - **未配 R2**（无信用卡 / 未开通）→ 封面自动落仓库 `public/covers/videos/`，`coverUrl` 记站内相对路径 `/covers/videos/<slug>.jpg`，二进制随站点部署。
>
> 一句话定位修正：**「本站是链接索引服务 + 短视频封面存储（R2 优先，仓库内降级）」**——除短视频封面外，不存储任何媒体文件（视频 / 图片 / 正文），仅通过外链引用与 302 跳转导流到原站。
>
> 为什么推荐 R2 而不是只用仓库内 `public/covers`：Cloudflare Pages 单次部署上限 **20,000 文件**、封面进 git 历史会膨胀仓库（GitHub 推荐 < 1 GB）；R2 免费 **10 GB 存储 + 1M A 类 + 10M B 类操作/月、出网费为零**、S3 兼容。但规模小（几百张以内）时仓库内完全够用、零配置零信用卡。详见第 4 节。

---

## 2. 怎么推送（GitHub 即 CMS）

本站没有后端写入接口，内容就是仓库里的文件。**推送 = 往仓库写文件 → 触发 Cloudflare Pages 自动重新部署**。

| 方式 | 适合 | 说明 |
|---|---|---|
| 直接提交到 `src/content/videos/` | 信任的自动化 / 已审核数据 | 推上去即上线（仍过 CI 质量门） |
| 先写 `data/pending/videos/` 再 `promote` | 需人工审核的数据 | 人工复核后 `npm run promote` 晋升，更稳 |
| 开 Pull Request | 第三方项目 / 外部贡献 | 走 `validate.yml` 质量门，管理员合并即上线 |

> 短视频（抖音 / TikTok）**不自动采集**（平台禁止抓取），所以**第三方推送是短视频数据的主要来源**。

---

## 3. 短视频数据格式（核心）

每个短视频 = `src/content/videos/<slug>.json` 一个 **JSON 数据文件**（扁平对象，无 frontmatter）。

### 3.1 字段表

| 字段 | 必填 | 类型 | 说明 |
|---|:--:|---|---|
| `title` | ✓ | string | 视频标题 |
| `creator` | ✓ | string | UP 主 / 作者名（短视频用 `creator`，不用 `author`） |
| `platform` | ✓ | enum | 必须是白名单值：`抖音` 或 `TikTok` |
| `sourceUrl` | ✓ | url | **跳转目标**，原站长链优先（如 `https://www.douyin.com/video/xxxx`） |
| `coverUrl` | ✓（短视频） | url/路径 | 封面地址，三者其一：① 仓库内相对路径 `/covers/videos/<slug>.jpg`（当前默认，零配置）② R2 公开 URL `https://<bucket>.r2.dev/videos/<slug>.jpg` ③ 第三方图床 URL。详见第 4 节 |
| `language` | ✗ | `zh` \| `en` | 默认 `zh` |
| `tags` | ✗ | string[] | 短视频**允许为空数组** `[]` |
| `review` | 建议 | string(40–200) | 列表页原创短评，写增量信息（适合谁/看点/避雷），**绝不写剧情简介** |
| `sourceId` | 建议 | string | 平台唯一 ID（如 `douyin:7351...`），用于去重 |
| `origin` | ✓ | enum | 推第三方数据填 `manual`（或 `csv`） |
| `pubDate` | ✓ | `YYYY-MM-DD` | 收录日期 |
| `metrics` | ✗ | object | 热度指标（见下）。有指标就必须带 `review` |
| `metrics.views` | ✗ | int | 播放量 |
| `metrics.rating` | ✗ | number(0–10) | 评分 |
| `metrics.growth` | ✗ | number | 近 7 日增长百分比 |
| `metrics.rank` | ✗ | int | 来源榜单名次（仅用于站内排序，不展示） |
| `metrics.capturedAt` | ✗ | `YYYY-MM-DD` | 指标快照时间（freshness 信号） |

### 3.2 示例（一条完整短视频条目）

```json
{
  "title": "30 秒拉花教学",
  "creator": "brewstudio",
  "platform": "TikTok",
  "sourceUrl": "https://www.tiktok.com/@brewstudio/video/7152093847561023746",
  "coverUrl": "/covers/videos/coffee-art.jpg",   // 当前默认：仓库内相对路径（方式 B，零配置）；也可填 R2 公开 URL 或第三方图床 URL
  "language": "zh",
  "tags": ["咖啡", "教程"],
  "review": "节奏极快且动作全程无剪辑，适合想照着练手的人。缺点是完全没讲奶泡打发原理，零基础建议先看基础教程再来。",
  "sourceId": "tiktok:7152093847561023746",
  "origin": "manual",
  "pubDate": "2026-08-22",
  "metrics": {
    "views": 573000,
    "growth": 4.1,
    "capturedAt": "2026-09-01"
  }
}
```

### 3.3 文件名（slug）规则

文件名 = slug = URL 末段 = `entry.id`。优先级：

1. 有 `sourceId` → 用 `sourceId`，冒号替换为 `-`：`douyin:7351284771920364811` → `douyin-7351284771920364811.json`
2. 无 `sourceId` → 用 `sourceUrl` 末段 ID：`tiktok-7152093847561023746.json`
3. 都没有 → 人工给英文 slug：`coffee-art.json`（**绝不用中文文件名**）

> slug 必须全局唯一，否则等于站内重复内容（薄内容风险）。提交前可用 `npm run dedupe` 自检。

---

## 4. 短视频封面：怎么传、传到哪（必读）

封面是短视频条目**业务约定必填**项（schema 层面 `coverUrl` 为可选，但缺失时卡片回退默认封面、体验差；每日失效巡检还会清掉失效封面）。**不能只给抖音/TikTok 外链**——平台防盗链会拦截，卡片必裂图。

### 4.0 当前部署状态与怎么选

> ⚠️ **当前线上未配置 Cloudflare R2**（开通需境外信用卡，本项目暂未配）。因此封面走**自动降级中的「仓库内存储」**：把图放进仓库 `public/covers/videos/`，`coverUrl` 写站内相对路径 `/covers/videos/<slug>.jpg`，**零凭据、零配置、提交即生效**。
> 三种方式随时可切换；将来配了 R2，代码（`scripts/lib/r2.mjs` 的 `storeCover()`）自动改走 R2，无需改数据文件。

| 方式 | 你把图传到哪 | `coverUrl` 填什么 | 前提 | 适合 |
|---|---|---|---|---|
| **B 仓库内（当前默认）** | 仓库 `public/covers/videos/<slug>.<ext>` | `/covers/videos/<slug>.jpg`（根相对路径） | 无 | 现在就能用，零信用卡 |
| A R2（可选升级） | Cloudflare R2 桶 `videos/<slug>.<ext>` | `https://<bucket>.r2.dev/videos/<slug>.jpg` | 配 R2 + 环境变量 | 封面过几千张、想减负 git |
| C 自有图床 | 你自己的 CDN / 图床 | 该图床公开 URL | 你有稳定图床 | 纯 link index、仓库最干净 |

> 推荐：**现在直接用方式 B（仓库内）**，最简单；等封面量大或开了 R2 再迁 A。

### 4.1 方式 B — 仓库内存储（当前默认，零信用卡零配置）

把封面二进制文件放进 `public/covers/videos/`，与 JSON 一起提交即可：

```
public/covers/videos/
└── coffee-art.jpg              ← 封面二进制（与 JSON 同 slug）
src/content/videos/
└── coffee-art.json             ← coverUrl 指向上面的图
```

JSON 里写站内相对路径：
```json
"coverUrl": "/covers/videos/coffee-art.jpg"
```
- `<slug>` 与 JSON 文件名一致（`coffee-art.json` → `coffee-art.jpg`）。
- 也可用脚本自动落盘（无 R2 时自动走仓库内）：`node scripts/store-cover.mjs https://.../cover.jpg coffee-art --apply` 会打印 `/covers/videos/coffee-art.jpg` 并落盘。
- 二进制随站点部署（Cloudflare Pages 带宽无限）。注意：每张封面占 Pages 部署 **20,000 文件**名额且进 git 历史；几千张内无压力，更大再迁 R2。

### 4.2 方式 A — Cloudflare R2（可选规模化升级）

配了 R2（环境变量 `R2_*` 齐全）后，`storeCover()` 自动把封面写到 R2 桶，仓库只记 R2 公开 URL。第三方两种直传：
- **直传端点**（无需 R2 密钥，持 `COVER_UPLOAD_TOKEN` 口令）：
```bash
curl -X POST https://<你的域名>/api/cover \
  -H "x-cover-token: <COVER_UPLOAD_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://.../cover.jpg","slug":"coffee-art"}'
# 返回 {"ok":true,"url":"https://<bucket>.r2.dev/videos/coffee-art.jpg","key":"videos/coffee-art.jpg"}
```
把返回 `url` 填进 `coverUrl`。不传 `slug` 时由源 URL 自动生成。
- **脚本/CI**：`node scripts/store-cover.mjs https://.../cover.jpg coffee-art --apply`（需 R2 凭据）。
桶名示例 `hublinks-covers`，对象键 `videos/<slug>.<ext>`，免费 10 GB、出网费为零、S3 兼容。

### 4.3 方式 C — 自有图床（最简，纯 link index）

第三方自己托管封面（任意稳定图床 / CDN），直接把公开 URL 填进 `coverUrl`：
```json
"coverUrl": "https://你的图床/coffee-art.jpg"
```
仓库只记录链接，最贴合「GitHub 只记录链接地址」初衷；本站不托管该二进制。

### 4.4 封面要求

- 格式：JPG / PNG / WebP；建议竖图 `400×600`（卡片比例 `2:3`）。
- 体积：尽量 < 200 KB（`/api/cover` 上限 5 MB）。
- **务必先传封面、拿到地址再提交 JSON**：`coverUrl` 失效，每日巡检会清空该字段、回退默认封面。
- 方式 B 把二进制放 `public/covers/videos/`（与 JSON 同提交）；方式 A/C 不往仓库放二进制。

> 闭环：条目被下架时（DMCA 表单 / 存活巡检 `check-links.js` / `prune` 自动下架）会**同步删除其封面文件**——仓库内封面经 git 删除、R2 封面经 `deleteObject` 删除，不会残留孤儿文件。第三方图床 URL 不在本站资源内，不处理。
- `coverUrl` schema 同时接受「绝对 URL」与「根相对路径 `/...`」，三种写法都合法。

### 4.5 运维侧：R2 桶与凭据配置（仅选方式 A 时需要，一次性）

1. Cloudflare 控制台 → R2 → 创建桶（如 `hublinks-covers`），开启 **Public bucket**（得 `https://<bucket>.r2.dev` 或绑自定义域）。
2. R2 → 管理 API 令牌 → 创建令牌（Object Read/Write），记下 Access Key / Secret。
3. Pages 项目 → Settings → Bindings → 添加 R2 桶绑定，变量名 **`COVER`**，绑该桶（供 `/api/cover`）。
4. Pages → Settings → Environment variables：`R2_PUBLIC_URL` = `https://<bucket>.r2.dev`、`COVER_UPLOAD_TOKEN` = `<长随机串>`。
5. 本地 / CI 用 S3 凭据（非绑定）：shell 或仓库 Secrets 配 `R2_ACCOUNT_ID` / `R2_BUCKET` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`（CI 再 + `R2_PUBLIC_URL`）。
6. 每日巡检 `check-links.js` 按 `http(s)` 检查 R2/图床封面；方式 B 的站内相对路径会自动跳过、不会被误清空。
> 中国大陆发卡行（实测中信万事达 i 白金）在 Cloudflare/Stripe 绑卡常被硬拒，属风控非配置问题；此时直接用方式 B 即可，无需 R2。详见 `R2_SETUP.md` 踩坑清单。

---

## 5. 跳转与导流（第三方无需实现）

第三方只需提供 `sourceUrl`（跳转目标）。跳转由本站自动完成：

- **Cloudflare Pages 真实 302**：构建时由 `scripts/generate-redirects.mjs` 扫描所有条目生成 `dist/_redirects`，形如：
  ```
  /videos/coffee-art/  https://www.tiktok.com/@brewstudio/video/7152...  302
  ```
- **兜底 HTML 跳转页**：每个条目另生成静态页（`<meta refresh>` + `location.replace`），本地预览 / 非 Cloudflare 环境同样能跳。

第三方**不需要**实现跳转逻辑，只保证 `sourceUrl` 是原站可访问的长链即可。

---

## 6. 合规要求（强行规，违反将被拒绝 / 下架）

- **只收录正版平台**：`platform` 必须命中白名单（`抖音` / `TikTok` 对短视频）；`sourceUrl` 主机须为对应官方域名。盗版站、网盘聚合、未授权转载一律拒绝。
- **不存储正文 / 视频**：详情页是跳转页，正文留给原站；本站只存短视频封面（见第 1、4 节）。
- **原创短评**：`review` 只写增量信息（适合谁 / 看点 / 避雷），**绝不复制源站剧情简介**（重复内容会被谷歌判薄内容）。
- **外链属性**：本站自动为所有外链加 `target="_blank" rel="noopener noreferrer"`。
- **下架通道**：提供 DMCA 页面，权利人可一键申请下架（仓库内条目可还原，非物理删除）。

---

## 7. 接入自检清单

- [ ] 文件落在 `src/content/videos/<slug>.json`（或先放 `data/pending/videos/`）
- [ ] `title` / `creator` / `platform` / `sourceUrl` / `coverUrl` / `pubDate` / `origin` 齐全
- [ ] `platform` ∈ {`抖音`, `TikTok`}，`sourceUrl` 为官方长链
- [ ] 封面已存（方式 A/B/C 任选），`coverUrl` 为对应地址（R2 公开 URL / `/covers/videos/...` 相对路径 / 第三方图床）
- [ ] 有 `metrics` 就必须有 `review`（否则过不了 CI 质量门）
- [ ] `slug` 唯一（跑 `npm run dedupe` 确认无重复）
- [ ] 提交后 Cloudflare Pages 自动部署，卡片应正常显示封面并可跳转

---

## 8. 漫画 / 小说（对照参考）

漫画 / 小说**不走封面本地存储**——它们的封面用原站外链（`coverUrl` 填原站图 URL，失效自动回退默认封面）。字段基本相同，区别：

- 用 `author` 代替 `creator`；可加 `status: "ongoing" | "completed"`。
- `tags` 不可空（短视频允许空）。
- 详见 [`../DATA_FORMAT.md`](./DATA_FORMAT.md) 与 [`../README.md`](./README.md)。

---

## 9. 相关文件

| 文件 | 作用 |
|---|---|
| `src/content/config.ts` | zod schema + 平台白名单（唯一事实来源） |
| `src/content/videos/*.json` | 短视频数据条目 |
| `public/covers/videos/*` | 短视频封面二进制（R2 未配置时的本地降级存储） |
| `scripts/generate-redirects.mjs` | 生成 302 跳转规则 |
| `scripts/dedupe.mjs` | 重复检测（接入前自检） |
| `scripts/check-reviews.mjs` | review 合规校验（CI 质量门） |
| `MAINTENANCE.md` | 人工增删改 / 审核 SOP |
