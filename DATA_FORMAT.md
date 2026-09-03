# 数据格式与组织规范（Data Format & Organization）

本文件说明三类内容（短视频 / 漫画 / 小说）在仓库里**如何存放、文件长什么样、几千条时文件名怎么定**。
这是给编辑 / 采集脚本 / 审核流程看的事实来源，schema 本身在 `src/content/config.ts`（zod 校验）。

> **2026-09 存储格式变更**：videos / comics / novels 已从 Markdown 改为 **JSON 数据文件**
> （Astro `type: 'data'` 集合，自动 glob 加载 `src/content/<type>/*.json`）。
> editorial（专题长文）因含长文正文，仍保留 Markdown。下文凡说「条目」若无特别说明，均指前三类 JSON 文件。

---

## 一、存放位置（天然多文件，不是单文件）

```
src/content/
├── videos/    # 短视频，每个条目一个 .json
├── comics/    # 漫画，每个条目一个 .json
├── novels/    # 小说，每个条目一个 .json
├── editorial/ # 专题长文（Markdown，独立集合，不在本规范讨论范围）
└── removed/   # 下架归档（在项目根，不在 src/content 内）
```

Astro Content Collections 的模型就是 **「一个条目 = 一个文件」**。所以：

> **几千条数据不会塞进同一个文件。** 每条目独立成文件，目录里就是几千个 `.json`。
> 你担心的「单文件难维护」在这个架构里从设计上就不存在。

只有 `data/pending/` 下的**待审核队列**才是「采集产出先堆这里、人工复核后再晋升到 `src/content/`」。

---

## 二、单条数据长什么样（数据格式）

每个 `.json` 文件 = 一个扁平 JSON 对象（无正文、无 frontmatter 包裹；详情页是 noindex 跳转页，正文本就不索引）。

以短视频为例（`src/content/videos/street-food.json`）：

```json
{
  "title": "深夜街边小吃摊",
  "creator": "城市夜行者",
  "platform": "抖音",
  "sourceUrl": "https://www.douyin.com/video/7351284771920364811",
  "coverUrl": "https://picsum.photos/seed/street-food/400/600",
  "language": "zh",
  "tags": ["美食", "探店"],
  "review": "镜头怼得很近，油声和叫卖都收进去了……",
  "sourceId": "douyin:7351284771920364811",
  "origin": "manual",
  "pubDate": "2026-08-30",
  "metrics": {
    "views": 862000,
    "growth": 12.7,
    "capturedAt": "2026-09-01"
  }
}
```

字段注意事项：
- `pubDate` / `metrics.capturedAt` 在 JSON 中以 `"YYYY-MM-DD"` 字符串存储，`config.ts` 用 `z.coerce.date()` 转回 `Date`。
- 字符串里的冒号、引号、特殊字符**无需转义**——这是 JSON 相比 YAML frontmatter 的主要优势（YAML 的冒号坑已彻底消失）。
- `review` 是 40–120 字编辑短评，写**增量信息**不写剧情简介。

### 字段速查表

| 字段 | 短视频 | 漫画 | 小说 | 说明 |
|---|:--:|:--:|:--:|---|
| `title` | ✓ | ✓ | ✓ | 显示标题 |
| `creator` / `author` | creator | author | author | 作者/UP 主 |
| `platform` | ✓ | ✓ | ✓ | 必须在白名单 |
| `sourceUrl` | ✓ | ✓ | ✓ | 跳转目标（原站长链） |
| `coverUrl` | 可选 | 可选 | 可选 | 失效自动回退 `default-cover.svg`（整字段删除，不置空串） |
| `language` | ✓ | ✓ | ✓ | zh / en |
| `tags` | ✓（可空） | ✓ | ✓ | 短视频允许空数组 |
| `review` | 可选 | 可选 | 可选 | 40–120 字编辑短评，写**增量信息**不写剧情简介 |
| `sourceId` | 可选 | 可选 | 可选 | 平台唯一 ID，去重用 |
| `origin` | ✓ | ✓ | ✓ | manual/api/html/csv |
| `pubDate` | ✓ | ✓ | ✓ | 收录日期（"YYYY-MM-DD"） |
| `metrics` | 可选 | 可选 | 可选 | views/rating/growth/rank/subscribers/capturedAt |
| `status` | — | ✓ | ✓ | ongoing / completed（漫画/小说） |

> **详情页是 noindex 跳转页**，正文一个字都不会被谷歌索引。所以**原创文案要放在列表页卡片的 `review` 字段和 `editorial` 专题页**，不要指望详情页正文贡献 SEO。

---

## 三、文件名（slug）怎么写 —— 几千条的关键

文件名 = slug = URL 末段 = 数据集合的 `entry.id`。例如 `src/content/videos/street-food.json` → 访问 `/videos/street-food/`。

### 三条优先级规则（工具见 `scripts/slugify.mjs`）

1. **优先用 `sourceId`**（最佳）
   - 例：`sourceId: "douyin:7351284771920364811"` → 文件名 `douyin-7351284771920364811.json`
   - 理由：稳定（标题会变，ID 不变）、唯一（天然去重）、纯 ASCII（URL 友好）、几千条也不怕撞名。
   - 注意 `sourceId` 里的 `:` 在文件名中需替换（导入脚本用 `-` 替换，见 `import.mjs`）。
2. **无 sourceId 时用 `sourceUrl` 末段 ID**
   - 抖音 `/video/7351284771920364811`、TikTok `/@user/video/7351...` 末段就是视频 ID。
   - 例：`tiktok-7351284771920364811.json`
3. **都没有 → 人工给英文 slug**（音译 / 意译 / 拼音）
   - 例：`street-food.json`、`funny-cat.json`
   - **绝不要直接中文文件名**：`深夜街边小吃摊.json` 经 URL 编码会变成 `/videos/%E6%B7%B1%E5%A4%9C.../`，既丑又不 SEO 友好。

> 本仓库零第三方依赖（脚本只用 Node 内置模块），没有拼音库，所以**中文标题无法自动转英文 slug**——这一步需人工提供，或优先走 sourceId 方案。

### 唯一性与冲突

- 文件名即 slug，文件已存在 = 冲突。脚本 `slugify.mjs check` 可校验。
- 同作品多平台录入 = **站内重复内容**（薄内容风险），用 `npm run dedupe` 检测（按归一化标题 / sourceId / sourceUrl 三维去重）。

---

## 四、几千条的组织方式

### 方案 A：平铺同一目录（推荐起步）

```
src/content/videos/
├── douyin-7351284771920364811.json
├── tiktok-7351284771920364811.json
├── street-food.json
└── ...（几千个）
```

- Astro 原生支持，无需改路由。
- **性能**：构建期会把所有 `.json` 解析进内存生成类型安全导入。几千条可行（构建从秒级变分钟级）；上万条要关注构建时长与 Pagefind 索引体积。

### 方案 B：按平台子目录（量大时可选）

```
src/content/videos/
├── douyin/
│   └── 7351284771920364811.json
└── tiktok/
    └── 7351284771920364811.json
```

- Astro 递归收集，`entry.id` 会带路径前缀（如 `douyin/7351...`），链接变成 `/videos/douyin/7351.../`。
- 需确认 `ListView` / `FilterNav` / 平台页的生成逻辑兼容带前缀的 id（当前用 `entry.id` 拼 URL，天然兼容）。

### JSON 已是标准存储

短视频详情页是 noindex 跳转页，**本身无 SEO 价值**，真正的价值在列表页 + 专题页。videos / comics / novels 已统一用 JSON 数据文件：
- 规避了 YAML frontmatter 的冒号 / 特殊字符转义坑；
- 每文件一 JSON、slug = 文件名，Git diff 清爽、易 review；
- 几千条规模下完全够用。

如果量级到**上万条**且高频更新，或想用数据库 / CMS / 外部 API 作为唯一事实来源，再考虑自定义 loader 或外部源——那属于架构升级，当前规模不必做。
editorial（专题长文）因含长文正文，保留 Markdown（`type: 'content'`），不参与上述 JSON 集合。

---

## 五、与采集系统衔接

```
采集脚本 harvest.mjs  →  data/pending/videos/<slug>.json   （待审核）
人工复核  →  node scripts/promote.mjs --apply  →  src/content/videos/<slug>.json  （上线）
存活巡检 prune.mjs  →  dead 条目移入 removed/videos/<slug>.json  （下架）
```

- `pending` / `src/content` / `removed` 三处文件名（slug）保持一致，便于追踪同一作品的生命周期。
- 自动采集的条目 `sourceId` 必填，因此文件名天然走「方案 1」，不会撞中文名。
- 半自动录入走 `import.mjs`（读 `data/import.json` → 写 `data/pending/<type>/<slug>.json`）。
- 失效链接巡检走 `check-links.js`（读 JSON，失效封面整字段删 `coverUrl`，源站下架则移入 `removed/`）。

---

## 六、编辑短评（review）文案模板

`review` 是每条目在列表页卡片上展示的**原创短评**，也是「编辑精选」板块能否收录该条的硬性门槛
（逻辑见 `src/lib/content.ts` 的 `pickEditorPicks`：无 `review` 的条目再热也不进精选）。

### 模板结构（40–120 字，四选二即可）

> **[适合谁看]** + **[核心看点 / 价值]** + **[避雷提示 / 前提]** + **[更新稳定性]**

- **适合谁**：给读者一个"这是不是给我看的"的快速判断
- **核心看点**：源站简介里没有的增量信息（为什么值得点开）
- **避雷提示**：什么人可能踩坑、哪里有门槛（如"零基础慎入"）
- **更新稳定性**：连载是否稳定、作者是否习惯拖更（对漫画/小说尤其重要）

### 正例（引用现有条目）

- 短视频：`"节奏极快且动作全程无剪辑，适合想照着练手的人。缺点是完全没讲奶泡打发原理，零基础建议先看基础教程再来。"`
- 漫画：`"Greek myth retold as a pastel-coloured office romance. The art carries the mood better than the plot, so it suits readers who want atmosphere; the pacing sags through the middle third."`

### 反例（禁止）

- ❌ **剧情简介**：`"讲述少年路飞为了成为海贼王而出海冒险的故事……"`（复制源站 = 重复内容，加重薄内容判定）
- ❌ **空话**：`"非常精彩，强烈推荐，大家快来看。"`（无增量信息，对读者无意义）
- ❌ **超长**：超过 120 字会触发 schema 校验失败（上限 `z.string().max(200)`，建议控制在 120 字内）

### 校验

`scripts/check-reviews.mjs`（建议接入 CI）会扫描全部条目，对「有热度指标却没写 review」的条目告警——
因为它们无法进入编辑精选，等于白采了热度数据。
