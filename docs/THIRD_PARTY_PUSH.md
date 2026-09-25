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
> 因此本站**对短视频封面做本地存储**：第三方把封面图文件一并发到仓库，仓库里只记录该文件的**链接地址**（`coverUrl`），二进制随站点一起部署。
>
> 一句话定位修正：**「本站是链接索引服务 + 短视频封面本地存储」**——除短视频封面外，不存储任何媒体文件（视频 / 图片 / 正文），仅通过外链引用与 302 跳转导流到原站。

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
| `coverUrl` | ✓（短视频） | url / 路径 | **短视频封面本地存储后的链接**（见第 4 节），如 `/covers/videos/<slug>.jpg` |
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
  "coverUrl": "/covers/videos/coffee-art.jpg",
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

## 4. 短视频封面存储规范（必读）

封面是短视频条目**必填**项，且**必须本地存储**，不能只给外链。

### 4.1 存储位置

把封面图二进制文件放进：

```
public/covers/videos/<slug>.jpg
```

`public/` 下的文件会被 Cloudflare Pages 原样发布到站点根，因此该图在线地址为：

```
https://<你的域名>/covers/videos/<slug>.jpg
```

`<slug>` 与第 3 节 JSON 文件名**保持一致**，方便追踪同一条数据的生命周期。

### 4.2 JSON 里只记链接

`coverUrl` 写**站点内相对路径或绝对地址**，不要写抖音/快手的外链（会被防盗链拦截）：

```json
"coverUrl": "/covers/videos/coffee-art.jpg"
```

> 仓库里**只存链接地址**，封面二进制随站点部署。这就是「github 上只记录链接地址」的含义。

### 4.3 封面要求

- 格式：JPG / PNG / WebP；建议竖图 `400×600` 左右（卡片比例 `2:3`）。
- 体积：尽量 < 200 KB，避免拖慢站点与构建。
- **务必同时提交 JSON 与封面文件**：只提交 JSON 而忘了传图，`coverUrl` 会 404，每日失效巡检会把 `coverUrl` 整字段清空、回退默认封面。
- 不要提交到 `src/content/` 里——封面是静态资源，放 `public/covers/videos/`。

### 4.4 目录结构示例（一次完整推送）

```
public/covers/videos/
└── coffee-art.jpg                 ← 封面二进制（随站点部署）

src/content/videos/
└── coffee-art.json                ← 数据文件，coverUrl 指向上面的图
```

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
- [ ] 封面二进制已提交到 `public/covers/videos/<slug>.<ext>` 且 `coverUrl` 指向它
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
| `public/covers/videos/*` | 短视频封面二进制（本地存储） |
| `scripts/generate-redirects.mjs` | 生成 302 跳转规则 |
| `scripts/dedupe.mjs` | 重复检测（接入前自检） |
| `scripts/check-reviews.mjs` | review 合规校验（CI 质量门） |
| `MAINTENANCE.md` | 人工增删改 / 审核 SOP |
