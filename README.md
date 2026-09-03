# Content Aggregator — 海外合规内容聚合站

一个面向海外用户的**内容发现与导流**网站，聚合三类内容：短视频（抖音 / TikTok）、漫画、小说。

> ⚠️ **核心定位：纯链接索引服务（Link Index）**
> 本站**不存储任何媒体文件**（视频 / 图片 / 正文），仅通过外链引用与 302 跳转把用户导流到原站。

---

## 技术栈

| 层级 | 技术 | 说明 |
| --- | --- | --- |
| 框架 | Astro 4.x (SSG) | 输出纯静态 HTML |
| 内容 | JSON 数据文件（短视频/漫画/小说）+ Markdown（专题长文） | Astro Content Collections（data + content） |
| 搜索 | Pagefind | 构建时生成静态索引，零后端 |
| 样式 | Tailwind CSS 3 | 响应式 |
| 部署 | Cloudflare Pages | 全球 CDN，自带 `_redirects` 302 支持 |
| 国际化 | 中 / 英双语 | `/` 中文站、`/en/` 英文站，内容按 `language` 分流 |
| 采集 | Node 脚本（零依赖） | 正版平台榜单自动采集 → `data/pending/` 待审核队列 |
| 自动化 | GitHub Actions | 每日失效链接检查 + 每日自动采集 + 内容质量门 |
| 运行时 | Node.js 20+ | 构建与脚本环境 |

---

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 本地开发
npm run dev

# 3. 生产构建（含 Pagefind 索引 + Cloudflare 302 规则生成）
npm run build

# 4. 本地预览构建产物
npm run preview
```

---

## 目录结构

```
├── src/
│   ├── content/           # 内容：JSON 数据（短视频/漫画/小说）+ Markdown（专题长文）
│   │   ├── config.ts      # Collections Schema（zod 校验）+ 平台白名单
│   │   ├── videos/        # 短视频（tags 允许为空）
│   │   ├── comics/        # 漫画
│   │   ├── novels/        # 小说
│   │   └── editorial/     # 专题长文（可索引，抗薄内容主力）
│   ├── i18n/              # 双语文案字典 ui.ts / 合规页文案 pages.ts
│   ├── lib/content.ts     # 内容筛选 / 排序 / 双语过滤 / 分页 / 路径工具
│   ├── components/        # Card / Search / FilterNav / AffiliateBanner
│   │                    # + HomeView / ListView / StaticPage / RedirectView / SearchView
│   │                    # + EditorialList / EditorialArticle / Pagination / SeoData / AdSlot
│   │                    # + DmcaForm / DmcaPage
│   ├── layouts/           # 全局布局（含语言切换 + hreflang 回退）
│   ├── pages/
│   │   ├── index.astro        # 中文站首页
│   │   ├── en/index.astro     # 英文站首页
│   │   ├── videos|comics|novels/
│   │   │   ├── index.astro          # 列表页
│   │   │   ├── page/[page].astro    # 分页（第 2 页起）
│   │   │   ├── platform/[...rest].astro  # 平台筛选静态页（+ 其分页）
│   │   │   └── [...slug].astro      # 详情跳转页（noindex → 302）
│   │   ├── editorial/{index,[...slug]}.astro   # 专题列表 / 详情
│   │   ├── editorial-policy.astro   # 收录标准与编辑方针（E-E-A-T）
│   │   ├── en/...                   # 英文版对应页
│   │   ├── robots.txt.ts            # 动态生成（逐条目精确 Disallow）
│   │   ├── search.astro / en/search.astro
│   │   └── about / dmca / privacy / disclaimer（含 /en/ 版本）
│   └── styles/global.css
├── functions/
│   └── api/dmca.ts        # Cloudflare Pages Function：DMCA 直接下架（GitHub API）
├── scripts/
│   ├── lib/               # fetch / markdown / sources / adapters（零依赖）
│   ├── harvest.mjs        # 自动采集主入口（榜单 → 待审核）
│   ├── import.mjs         # 半自动导入（反爬平台 / 批量粘贴）
│   ├── promote.mjs        # 人工复核后晋升 pending → src/content
│   ├── add-entry.mjs      # 录入脚手架：一条命令生成标准 JSON 条目（可直推 GitHub）
│   ├── dedupe.mjs         # 重复条目检测（sourceId / sourceUrl / 标题）
│   ├── prune.mjs          # 存活巡检：源站失效条目移入 removed/
│   ├── check-links.js     # 每日失效链接检查
│   ├── generate-redirects.mjs  # 生成 dist/_redirects（Cloudflare 302）
│   └── generate-sitemap.mjs    # 生成 sitemap（自写，替代不兼容 Astro 4 的官方集成）
├── data/
│   ├── pending/           # 采集 / 导入产出的待审核内容（不进构建）
│   └── import.example.json   # 半自动导入模板
├── .github/workflows/
│   ├── daily-check.yml    # 每日失效链接检查
│   ├── harvest.yml        # 每日自动采集 → data/pending
│   ├── prune.yml          # 每日存活巡检（liveness）
│   └── validate.yml       # 内容质量门（push / PR 到 main 时校验）
├── public/                     # 静态资源（default-cover.svg 等）
└── ...
```

---

## 日常维护（GitHub 即 CMS）

本站**没有后台管理系统**——内容就是仓库里的文件，维护 = 编辑文件 → `git push` → Cloudflare 自动重新部署。
日常增删改、自检、CI 守卫的完整 SOP 见 **[`MAINTENANCE.md`](./MAINTENANCE.md)**。

一句话新增条目（自动生成标准 JSON 并可选直接推送）：

```bash
node scripts/add-entry.mjs --type videos --title "拉花教学" --platform 抖音 \
    --sourceUrl "https://v.douyin.com/xxxx/" --creator "咖啡师阿杰" --commit --push
```

---

## 跳转逻辑说明（重要）

由于本站在 `output: 'static'`（纯静态）模式下运行，Astro 的 `Astro.redirect()` **在静态构建中不可用**（会在构建时报错）。因此采用**双保险**方案：

1. **Cloudflare Pages 真实 302**：`scripts/generate-redirects.mjs` 在构建后扫描所有内容条目，生成 `dist/_redirects`，形如：
   ```
   /videos/funny-cat/  https://www.douyin.com/video/xxxx  302
   ```
   Cloudflare 会在边缘节点直接返回 302，不经过 HTML。

2. **兜底 HTML 跳转页**：每个内容条目仍生成一个静态页，内含 `<meta http-equiv="refresh">` + `window.location.replace()`，在非 Cloudflare 环境或本地预览时同样能跳转。

> 跳转页带有 `noindex, follow` 与 `data-pagefind-ignore`，避免污染搜索引擎索引与站内搜索结果。

---

## 内容编写（JSON 数据文件）

短视频 / 漫画 / 小说条目是 `src/content/<videos|comics|novels>/<slug>.json` 的 **JSON 数据文件**（非 Markdown）。
推荐用脚手架生成标准文件，避免手敲字段出错：

```bash
node scripts/add-entry.mjs --type videos --title "拉花教学" --platform 抖音 \
    --sourceUrl "https://v.douyin.com/xxxx/" --sourceId "douyin:7351..." --creator "咖啡师阿杰" \
    --rating 8.7 --views 1200000 --growth 12 --rank 3 \
    --tags "咖啡,教学" --lang zh --review "节奏极快且动作全程无剪辑，适合碎片时间临摹拉花；追更稳定。" \
    --commit --push
```

手写 JSON 时字段如下（详见 [`DATA_FORMAT.md`](./DATA_FORMAT.md) 与 [`MAINTENANCE.md`](./MAINTENANCE.md)）：

```json
{
  "title": "搞笑猫咪合集第12期",
  "creator": "@猫咪日记",
  "platform": "抖音",
  "sourceUrl": "https://www.douyin.com/video/7348329102938475612",
  "coverUrl": "https://p3-sign.douyinpic.com/tos-cn-p-001/xxx.jpg",
  "pubDate": "2026-07-30",
  "tags": ["宠物", "搞笑"],
  "metrics": { "rating": 8.5, "views": 1200000, "capturedAt": "2026-07-30" },
  "review": "更新稳定、单集时长都在 30 秒内，适合碎片时间刷；不追求剧情，纯解压向。"
}
```

- `sourceUrl`：**必填**，跳转目标（原站长链优先）。
- `coverUrl`：可选，封面图外链；为空或失效时自动回退到 `default-cover.svg`（缺省时**整字段省略**，不要写空串）。
- `metrics`：可选，热度指标（rating / views / growth / rank / subscribers / capturedAt）。有指标就必须写 `review`，否则进不了「编辑精选」。
- `review`：**强烈建议填写**（40–200 字）。这是列表页上唯一的原创文本，直接对抗薄内容判定。
  规范见 `config.ts` 注释 —— 只写源站没有的增量信息（适合谁 / 看点 / 避雷 / 更新是否稳定），
  **绝不写剧情简介**（复制源站 = 重复内容，反而加重薄内容判定）。
- 漫画 / 小说用 `author` 代替 `creator`，并可加 `status: "ongoing" | "completed"`。
- 提交（push）后自动触发 Cloudflare Pages 重新部署。

### 专题长文（editorial）

详情页是 `noindex` 的跳转页，**写正文不会被索引**；有观点的长文只能落在专题页：

```markdown
---
title: "国漫入坑指南：从《一人之下》开始的三个方向"
description: "不按热度排，把国漫拆成三条入口，分别说明适合什么人、坑在哪。"
language: zh
type: comics                     # 决定在哪个集合里查找 entries
entries: [yi-ren-zhi-xia, ...]   # 引用的条目 slug，按推荐顺序
tags: [国漫, 入门]
pubDate: 2026-09-02
---

正文：800+ 字原创长文，用 Markdown 写作（支持 ## 小标题、加粗、列表）。
```

写作要点：**要有观点**（不排热度榜、说明坑在哪）、**要有结构**（分维度而不是罗列）、
**每条引用都要说明为什么值得点开**。模板化地夸 200 部作品 = scaled content abuse，比不写更糟。

自检标准：**把作品名遮掉，你还能认出写的是哪一部吗？** 认不出 = 模板废话 = 有害。
另外**不要写剧情简介**（那是复制源站，属于重复内容），只写源站没有的增量信息：
适合谁看、看点在哪、避雷提示、同类对比、更新是否稳定。

> ⚠️ **YAML 坑**：frontmatter 里若 `title` / `description` 含 **ASCII 冒号 `:`**，
> 必须用引号包裹（`title: "Short video: a filter"`），否则 gray-matter 会在构建期报
> `incomplete explicit mapping pair`。中文全角冒号 `：` 不受影响。

当前收录 6 篇，覆盖 **3 类型 × 2 语种**：

| 语种 | videos | comics | novels |
|---|---|---|---|
| 中文 | `duanshipin-zhe-san-lei` | `guoman-rukeng-zhinan` | `wangwen-nanpin-rukeng` |
| 英文 | `short-video-worth-finishing` | `where-to-start-webcomics` | `where-to-start-web-novels` |

每篇都在底部链向 `/editorial-policy/`（收录标准），把"我们凭什么这么选"变成可验证的内链。

---

## 自动化：每日失效链接检查

GitHub Actions 每天 UTC 12:00（北京时间 20:00）运行 `scripts/check-links.js`：

- **封面图失效**（404 / 403 / 超时）→ 清空该条目的 `coverUrl`，页面回退默认封面。
- **源链接下架**（404 / 410）→ 将 JSON 文件移入项目根目录 `removed/`（位于 `src/content` 之外，不会参与构建）。
- 检查完成后自动 `git commit` + `git push`，触发 Cloudflare Pages 重新部署。

> 也可本地手动运行：`npm run check:links`

**注意**：抖音 / TikTok 等平台有较强的反爬策略，对无浏览器特征的请求经常返回 403 或 999。脚本**只对源链接的 404 / 410 做删除**，不会因 403 / 超时误删内容，避免误伤。封面图则因用了 `referrerpolicy="no-referrer"`，检查结果相对可靠。

---

## 自动采集（Harvest）

目标：只收录**点击量高 / 评分高 / 增长快**的正版平台内容，且**自动采集链接、半自动录入**，减少人工抄写。

### 各平台采集可行性（分三档）

| 平台 | 档位 | 方式 | 说明 |
| --- | --- | --- | --- |
| Wattpad | api | 公开 API `/api/v3/stories` | 在 CI / 真实服务器通常可达；不可达时自动回退榜单页解析 |
| Webtoon / Tapas / 腾讯动漫 / 快看 / Webnovel / Wuxiaworld | html | 榜单页解析 | 读取公开排行榜 TOP 内容，按热度门槛过滤 |
| 番茄小说 / 漫客栈 | manual | 半自动导入 | 反爬较强（字体加密等），不走自动采集，用 `import.mjs` 粘贴链接录入 |

> 短视频（抖音 / TikTok）**不自动采集**——平台禁止抓取，需人工录入。其 `tags` 允许为空（Schema 已兼容）。

### 收录门槛

每个平台在 `scripts/lib/sources.mjs` 里配置 `threshold`，满足**任一**即保留：

- `maxRank`：榜单名次上限（如 Webtoon TOP20、腾讯动漫 TOP30）
- `minRating`：评分下限（如 Wattpad ≥ 8.0）
- `minViews`：阅读 / 播放量下限（如 Webtoon ≥ 100 万）
- `minGrowth`：近 7 日增长下限

### 版权安全：白名单 + 审核队列

- `sources.mjs` 中每个平台登记 `hosts` 白名单；`sourceUrl` 主机**必须命中**，否则拒绝入库（杜绝盗版站）。
- 自动采集结果**只写入 `data/pending/`**，**不会**直接进入 `src/content/`。人工复核（作者 / 封面 / 是否正版 / 是否在架）后，运行 `npm run promote` 晋升上线。

### 用法

```bash
# 1. 自动采集所有可采集平台 → data/pending/
npm run harvest
npm run harvest -- --only webtoon     # 只跑某个平台
DRY=1 npm run harvest                 # 只打印，不写盘

# 2. 反爬平台 / 批量：编辑 data/import.json 后
npm run import

# 3. 人工复核 data/pending/ 后，晋升到 src/content/
npm run promote                       # dry-run 预览全部待晋升
npm run promote                       # 实际移动（脚本内已带 --apply，移动全部）

# 3b. 自动审核（置信门控，可选）：只晋升"机器可验证"的条目，其余留人工
npm run promote:auto                  # dry-run 预览哪些可自动晋升
npm run promote:auto                  # 实际只移动通过置信门控的条目
```

> **自动审核能做什么、不能做什么**：`promote:auto` 只对 `origin ∈ {api, html}`（真来自适配器）、带完整 `sourceId`、有非空 `metrics`、且 `sourceUrl` 主机命中白名单的条目放行；任何需要人眼判断正版 / 封面 / 作者的条目都**保留在 pending**。默认 `npm run promote` 仍是全人工模式，不会无脑全过。
>
> **在 CI 中启用自动审核（可选）**：在仓库 `Settings → Secrets and variables → Actions → Variables` 新建 **Repository variable `AUTO_PROMOTE = 1`**，`harvest.yml` 会在每日采集后自动运行 `promote --auto --apply` 并把晋升结果提交。该步骤默认不执行（保持安全默认）；关闭变量即回到纯人工复核。

### 定时任务

`.github/workflows/harvest.yml` 每天 UTC 13:00（北京时间 21:00）运行 `npm run harvest` 并把新增的 `data/pending/` 提交回仓库。**只提交 pending，不自动上线**——晋升需人工确认（或显式启用 `promote:auto`）。

### 自动下架（存活巡检 Prune）

已上线的条目可能因源站删除 / 下架而变成死链。死链既伤害用户体验，也会被谷歌视为低质（影响收录与排名）。`prune.mjs` 定时回抓每个条目的 `sourceUrl` 并据此下架：

| 回抓结果 | 判定 | 动作 |
|---|---|---|
| HTTP 404 / 410 | `dead` | 移入 `removed/<collection>/`（重建后 302 与列表卡片自动消失） |
| HTTP 200 但页面明确"已下架/已删除" | `dead` | 同上 |
| HTTP 403 / 429 / 5xx / 超时 / 网络错 | `ambiguous` | **跳过，不删**（宁可放过，绝不误杀） |
| HTTP 200 正常 | `alive` | 保留 |

```bash
npm run prune            # dry-run：列出将会下架的条目，不改动
npm run prune:apply      # 演习同样只列出；除非 PRUNE_AUTO=1 才真实下架
```

- 下架 = **移动到 `removed/`**（与 DMCA 表单下架同一归档目录），并在 JSON 写 `takedownReason: dead-source` / `takedownDate` / `takedownMethod: auto-prune`，可 git 还原。
- **安全开关 `PRUNE_AUTO`（默认保守）**：脚本层做了防御性门控——**即使传 `--apply`，只要 `PRUNE_AUTO` 不是 `"1"`，一律强制 dry-run，绝不自动下架**。只有设置 `PRUNE_AUTO=1` 后，`--apply` 才会真正把 dead 条目移入 `removed/`。
- `.github/workflows/prune.yml` 每天 UTC 14:00（北京时间 22:00）自动运行 `node scripts/prune.mjs --apply`：
  - **默认（未开 `PRUNE_AUTO`）**：只输出 dry-run 报告，不改动文件、不提交。
  - **开启 `PRUNE_AUTO=1`（仓库 `Settings → Secrets and variables → Actions → Variables` 新建 Repository variable）**：真正下架并提交 `removed/` 与 `src/content/` 的变动。
- 主机不在白名单内的条目无法可靠验证，直接跳过。
- 与 DMCA 表单下架是两条互补通道：DMCA 是"用户投诉触发"，prune 是"源站失效自动发现"。

---

## DMCA 一键下架

站内 DMCA 页面（`/dmca/` 与 `/en/dmca/`）内置表单。举报人填写**待下架页面链接** + **原始作品链接** + **善意声明**后提交：

- **直接下架（推荐）**：在 Cloudflare Pages 配置 `GITHUB_TOKEN` + `GITHUB_REPO` 后，提交会经 `functions/api/dmca.ts` 通过 GitHub API 把 `src/content/<type>/<slug>.json` 移动到仓库根的 `removed/`，触发重新部署即生效下架。
- **兜底**：未配置后端时，表单自动打开预填好的 GitHub Issue（`labels=dmca-takedown`）由管理员处理。需用 `PUBLIC_DMCA_REPO=owner/repo` 指定仓库。

| 变量 | 作用 | 配置位置 |
| --- | --- | --- |
| `GITHUB_TOKEN` | 具备 repo 写权限的 token | Cloudflare Pages 环境变量 |
| `GITHUB_REPO` | 仓库坐标 `owner/repo` | Cloudflare Pages 环境变量 |
| `PUBLIC_DMCA_REPO` | 兜底工单的仓库（公开） | Astro `PUBLIC_` 环境变量 |
| `PUBLIC_DMCA_ENDPOINT` | 覆盖下架端点（默认 `/api/dmca`） | Astro `PUBLIC_` 环境变量 |
| `PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile 站点密钥 | Astro `PUBLIC_` 环境变量 |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile 密钥 | Cloudflare Pages 环境变量 |

### 防滥用：Cloudflare Turnstile CAPTCHA

DMCA 表单已集成 Turnstile 人机验证，**配置即生效，未配置则完全跳过**（不影响现有下架 / 工单兜底流程）：

- 前端（`src/components/DmcaForm.astro`）：配置了 `PUBLIC_TURNSTILE_SITE_KEY` 时自动渲染验证挂件，提交时取出 token 一并 POST；缺少验证则提示"请完成安全验证"。
- 后端（`functions/api/dmca.ts`）：配置了 `TURNSTILE_SECRET_KEY` 时，先向 `https://challenges.cloudflare.com/turnstile/v0/siteverify` 校验 token，失败返回 `422 { errors: { cfToken } }`，前端按字段展示。

> 获取密钥：Cloudflare 控制台 → Turnstile → 创建站点，把 Site Key / Secret Key 填入上述变量即可。如需进一步防滥用，可叠加下方的 IP 频率限制。

### IP 频率限制（Rate Limiting）

在 Turnstile 之上再叠加 **按客户端 IP 的提交频率限制**，防止单 IP 刷接口。基于 Cloudflare KV 的固定窗口计数器实现，**未绑定 KV 时自动跳过**（不影响现有下架 / 工单兜底流程）：

- **触发位置**：`functions/api/dmca.ts` 在解析请求后第一时间执行 `checkRateLimit()`，超限直接返回 `429 Too Many Requests` 并带 `Retry-After` 头，同时返回 `X-RateLimit-Limit` / `X-RateLimit-Remaining` / `X-RateLimit-Reset` 响应头。
- **默认阈值**：每 IP **5 次 / 小时**（窗口 3600 秒），可在 Cloudflare Pages 环境变量中调整：
  - `RATE_LIMIT_MAX`：单个窗口内允许的最大请求数（默认 `5`）
  - `RATE_LIMIT_WINDOW_SEC`：窗口长度（秒，最小 `60`，默认 `3600`）
- **存储**：使用 KV 命名空间 `RATE_LIMIT_KV` 记录计数（键 `rl:dmca:<ip>`），按窗口自动过期。

**启用步骤（生产）**：

1. 创建 KV 命名空间：
   ```bash
   npx wrangler kv namespace create RATE_LIMIT_KV
   ```
2. Cloudflare 控制台 → Pages → 你的项目 → **Settings → Functions → KV namespace bindings**，添加绑定：Variable name 填 `RATE_LIMIT_KV`，指向刚创建的命名空间。
3. 在 **Settings → Environment variables** 中按需设置 `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_SEC`。
4. 重新部署。未配置前接口照常工作，只是不限流。

> 本地用 `wrangler pages dev` 调试时，参考仓库根目录 `wrangler.toml` 模板（KV 绑定默认注释掉，限流会被优雅跳过）。

---

## 合规红线

### 必须做
- 所有外链 `target="_blank" rel="noopener noreferrer"`
- 封面图只引用原站外链，`referrerpolicy="no-referrer"`
- 提供 DMCA 投诉页，承诺 48 小时内响应
- Footer 包含联盟披露（Affiliate Disclosure）文字
- 提供 Privacy Policy 与 Disclaimer 页面
- 短视频链接优先使用长链（`www.douyin.com/video/xxx`）

### 绝对禁止
- 禁止存储任何媒体文件
- 禁止 iframe 嵌入播放 / 阅读
- 禁止破解防盗链或技术措施
- 禁止批量爬虫采集
- 禁止在国内服务器部署
- 禁止用家庭 NAS 作服务器

---

## 部署（Cloudflare Pages）

1. 将代码推送到 GitHub 仓库。
2. Cloudflare Pages → 连接该仓库。
3. 构建设置：
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Node.js version**: `20`
4. 绑定自定义域名 + 自动 SSL。
5. 每次 push 自动部署。

> 构建命令末尾的 `generate-redirects.mjs` 会自动生成 `dist/_redirects`，Cloudflare Pages 会原样采用这些 302 规则。

> 上线所需的所有环境变量与 KV 绑定，见 **[`ENV_VARS.md`](./ENV_VARS.md)** —— 按控制台位置、作用域、是否暴露前端分类，并附最小可上线配置与功能开关矩阵。

---

## SEO 与谷歌收录（已内置）

站点已内置一套面向 Google / Bing 的基础 SEO 基建，无需额外集成：

- **Sitemap**：`scripts/generate-sitemap.mjs` 在 `npm run build` 末尾扫描 `dist/`，排除「详情跳转页 / 搜索页 / 404 / pagefind 资源」后生成 `dist/sitemap-index.xml` + `dist/sitemap-0.xml`（仅收录列表页、首页、合规页等有价值页面）。
- **结构化数据（JSON-LD）**：每页输出 `Organization`；列表页额外输出 `BreadcrumbList` + `ItemList`，利于富结果。见 `src/components/SeoData.astro`。
- **hreflang 双向互链 + x-default**：`zh-CN` / `en` / `x-default` 三方声明，满足 Google 多语种互链要求（见 `src/layouts/Layout.astro`）。
- **动态 robots.txt**：`src/pages/robots.txt.ts` 随 `PUBLIC_SITE_URL` 自动写出正确的 `Sitemap:` 绝对地址，并 Disallow 跳转详情页。
- **列表页「编辑精选」长文榜单**：`src/components/ListView.astro` 在每类列表页（视频/漫画/小说，双语）底部，基于 `metrics`（评分/增长/播放/榜单名次）动态计算 Top N 并配原创点评文案 + 直达原站的出站链接，专门对抗 Google 对聚合站「thin/affiliate content」的判定。
- **详情页 noindex + 302**：详情跳转页自带 `noindex, follow`，不污染索引。
- **列表页原创引言**：每分类补充关键词丰富的原创描述段落，规避「薄内容 / affiliate thin content」风险。

### 抗薄内容（Anti-thin-content）专项

聚合站最容易被 Google 判「规模化低质 / thin content」。除上述基建外，站点内置了 7 项针对性改造：

| 措施 | 位置 | 作用 |
|---|---|---|
| **卡片编辑短评** `review` 字段 | `src/content/config.ts` + `Card.astro` | 每条 40–120 字原创点评，**渲染在可索引的列表页**上（详情页不索引，写正文零收益）。只写增量信息：适合谁 / 看点 / 避雷，**绝不写剧情简介**（复制源站 = 重复内容） |
| **专题长文页** `editorial` 集合 | `/editorial/` `/en/editorial/` | 唯一能承载有观点长文的可索引页面，每篇 800+ 字 + 引用条目卡片 + 相关专题内链 |
| **数据更新时间展示** | `ListView.astro` / `Card.astro` | 渲染 `metrics.capturedAt`，「数据更新于 X」= freshness 信号，证明数据被维护 |
| **收录标准 / 编辑方针页** | `/editorial-policy/` | E-E-A-T 核心证据：公开筛选门槛、审核流程、更新频率、利益冲突声明 |
| **首页「本周新增」** | `HomeView.astro` | 近 7 天新收录才展示，给爬虫持续回访的理由 |
| **去重检测** `npm run dedupe` | `scripts/dedupe.mjs` | 按 sourceId / sourceUrl / 归一化标题三维度查重，避免同作品多平台重复造成的站内重复内容 |
| **平台筛选静态化 + 分页 + 内链** | `src/pages/<type>/platform/[slug]/`、`page/[n]/` | 前端 JS 筛选爬虫看不到，静态页才是可爬的筛选维度；分页控制单页规模；列表↔专题双向内链 |

> **AI 生成文案的正确用法**：可以批量起草，但必须人工改到「遮掉作品名仍能认出写的是哪一部」，否则等于自己坐实 scaled content abuse。见 `config.ts` 中 `review` 字段的注释。

### robots.txt 的一个坑（已修）

`Disallow: /comics/*/` 这种通配写法在 robots 语法里会连带屏蔽 `/comics/platform/webtoon/` 与 `/comics/page/2/`。
`src/pages/robots.txt.ts` 因此改为**逐条目枚举精确路径**（构建期从内容集合生成），平台页与分页页不受影响。
同理 sitemap 的排除正则必须写 `^\/(en\/)?(videos|comics|novels)\/[^/]+\/?$`，否则英文跳转页会被误收录。

### hreflang 回退

并非每个页面在两种语言下都存在（英文站没有「快看」条目，条目不足时也没有第 2 页）。
`Layout` 支持 `alternates={{ zh, en }}` 显式覆盖，列表/平台/分页页由 `ListView` 逐级回退：
平台页 → 该语种无此平台则回退到分类列表页；分页页 → 该语种没这么多页则回退到第 1 页。
避免 hreflang 指向 404 导致 Google 丢弃整组标注。

### 上线后需手动完成（一次性）

1. **Google Search Console**：添加资源 → 获取验证字符串 → 填入 Cloudflare Pages 环境变量 `PUBLIC_GSC_VERIFICATION`（`<head>` 自动输出 `google-site-verification`）。
2. **提交 Sitemap**：在 GSC 的「Sitemaps」中提交 `https://你的域名/sitemap-index.xml`。
3. **Bing Webmaster Tools**：同理，验证字符串填入 `PUBLIC_BING_VERIFICATION`（输出 `msvalidate.01`）。
4. **持续供给原创/真实内容**：聚合站最易被谷歌判低质，保持列表页描述更新、条目持续新增，是长期收录与排名的关键。

---

## 广告接入（AdSense / Ezoic）

站点已预留广告位（`src/components/AdSlot.astro`），采用与全站一致的「env 驱动、未配置即优雅降级为占位框」策略，**不配任何变量也不会影响布局**。

- **Google AdSense（手动插槽）**：在 Cloudflare Pages 配 `PUBLIC_ADSENSE_CLIENT`（发布商 ID `ca-pub-...`）与 `PUBLIC_ADSENSE_SLOT`（默认插槽 ID），页面顶部/底部/列表页广告位即自动渲染 `<ins class="adsbygoogle">`。每个 `<AdSlot>` 也可单独传 `slot` 指定不同广告单元。
- **Ezoic（平台自动注入）**：把站点加入 Ezoic 并切换 DNS / 开启他们的集成后，广告由平台自动投放，**无需配置上述变量**，本组件保持占位降级即可。Ezoic 对小站过审更友好、RPM 通常优于纯 AdSense。
- **联盟营销**：见 `src/components/AffiliateBanner.astro`（已 env 驱动，配 `PUBLIC_AFFILIATE_URL` / `PUBLIC_AFFILIATE_LABEL` 即生效）。

> 变现前提：广告收入 ≈ 流量 × 千次展示收益（RPM）。聚合站需先做到稳定月 1 万+ 会话才有可观收入，前期重心应放在内容量与 SEO 收录上。收款走 Payoneer 等美国收款账户再提现国内银行卡，无需实体海外卡。

---

## 上线前 TODO

- [ ] 在 Cloudflare Pages → Settings → Environment variables（或本地 `.env`）配置以下 `PUBLIC_*` 变量（构建期读取，详见 `.env.example`）：
  - `PUBLIC_SITE_URL`：真实域名（生成 canonical / OG / sitemap 用）
  - `PUBLIC_AFFILIATE_URL` + `PUBLIC_AFFILIATE_LABEL`：你的联盟链接与名称
  - `PUBLIC_DMCA_EMAIL`：DMCA 投诉接收邮箱（替换文案中的 `dmca@example.com`）
  - `PUBLIC_DMCA_REPO` / `PUBLIC_DMCA_ENDPOINT` / `PUBLIC_TURNSTILE_SITE_KEY`：见上文 DMCA / CAPTCHA 表格
- [ ] 在 Cloudflare Pages 环境变量（保密，勿加 `PUBLIC_` 前缀）配置 `GITHUB_TOKEN` / `GITHUB_REPO`（DMCA 直接下架）与 `TURNSTILE_SECRET_KEY`（CAPTCHA 校验），并按需绑定 `RATE_LIMIT_KV`（IP 限流）
- [ ] 补充真实内容条目（示例条目中的 `sourceUrl` / `coverUrl` 为占位示例，coverUrl 使用了 picsum 占位图）
- [ ] 替换 `default-cover.svg` 与 `favicon.svg` 为你的品牌视觉
