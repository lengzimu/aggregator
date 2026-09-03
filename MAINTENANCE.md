# 维护手册（GitHub 即 CMS）

本站是纯静态站（Astro SSG + Cloudflare Pages），**没有后台管理系统**。
内容就是仓库里的文件，维护 = 编辑文件 → `git commit` → `git push` → Cloudflare 自动重新部署。

本文档是日常维护的唯一 SOP。所有命令都在仓库根目录运行。

---

## 核心心智模型

| 概念 | 说明 |
|---|---|
| 内容 = 文件 | 每部作品、每篇专题都是仓库里的一个文件 |
| 推送 = 发布 | `git push` 到 `main` 即触发 Cloudflare 重新部署，无需登录任何后台 |
| CI = 守门员 | 每次 push / PR 自动跑质量校验，低质/重复内容在部署前被拦下 |
| 采集 = 辅助 | `harvest` 只产出待审核草稿（`data/pending/`），晋升仍需人工确认 |

---

## 四种维护动作

| 动作 | 怎么做 | 触发部署 |
|---|---|---|
| **新增条目** | 脚手架生成 JSON，再 push（见下） | push 后自动 |
| **修改条目** | 直接编辑 `src/content/<type>/<slug>.json`，commit & push | push 后自动 |
| **下架条目** | `npm run prune` 巡检 → 确认后 `npm run prune:apply`（或开 `PRUNE_AUTO` 让 CI 自动移入 `removed/`） | 自动 |
| **写专题** | 编辑 `src/content/editorial/*.md`（Markdown 长文，可索引） | push 后自动 |

---

## 新增条目（推荐用脚手架）

`scripts/add-entry.mjs` 会按 schema 生成标准 JSON、自动算 ASCII 文件名、校验平台白名单，
并可一键 `git commit` / `git push`：

```bash
node scripts/add-entry.mjs --type videos --title "拉花教学" --platform 抖音 \
    --sourceUrl "https://v.douyin.com/xxxx/" --sourceId "douyin:7351..." --creator "咖啡师阿杰" \
    --rating 8.7 --views 1200000 --growth 12 --rank 3 \
    --tags "咖啡,教学" --lang zh \
    --review "节奏极快且动作全程无剪辑，适合碎片时间临摹拉花手法；更新稳定，追更友好。" \
    --commit --push
```

要点：
- `--type`：`videos` / `comics` / `novels`。漫画/小说用 `--author` 代替 `--creator`，可加 `--status ongoing|completed`。
- **文件名（slug）优先级**：`sourceId` > `sourceUrl` 末段视频 ID > `--slug` 手动英文。**绝不用中文文件名**（SEO/URL 隐患，CI 也会扫出来）。
- `--review` 是「编辑精选」准入门槛：有热度指标（`metrics` 非空）就必须写 40–200 字原创短评，否则该条目不会进首页/列表的精选板块。只写源站没有的增量信息，**绝不复述剧情简介**。
- 不加 `--commit` / `--push` 时只落盘，方便你先补 `coverUrl`、润色 `review` 再手动推送。
- `--dry-run` 只打印生成的 JSON，不改文件。

字段速查（完整见 [`DATA_FORMAT.md`](./DATA_FORMAT.md)）：

| 字段 | 必填 | 说明 |
|---|---|---|
| `title` | ✓ | 作品名 |
| `sourceUrl` | ✓ | 跳转目标（原站长链） |
| `platform` | ✓ | 须命中该类型平台白名单 |
| `creator` / `author` | ✓ | 短视频用 creator，漫画/小说用 author |
| `pubDate` | ✓ | 收录日期 `YYYY-MM-DD` |
| `coverUrl` | — | 封面外链；缺省时**整字段省略**（不要写空串） |
| `metrics` | — | `{rating,views,growth,rank,subscribers,capturedAt}` 部分即可 |
| `review` | 有指标时必填 | 40–200 字原创短评（编辑精选准入） |
| `tags` / `sourceId` / `language` / `status` | — | 可选 |

---

## 推前自检（必跑）

```bash
npm run dedupe        # 查站内重复（sourceId / sourceUrl 重复 = 确定重复）
npm run check:reviews # 查「有热度却没写 review」等编辑精选准入问题
```

也可直接看 CI 结果：每次 push 到 `main` 或开 PR，`.github/workflows/validate.yml`
会用 `--strict` 跑上面两个脚本，**存在确定重复或有告警则直接阻断部署**。

---

## 修改 / 下架

**改一条已有条目**：直接编辑对应 `src/content/<type>/<slug>.json`，改完 commit & push。
（注意 `coverUrl` 失效就**整行删掉该字段**，不要置空串——schema 是 url 校验，空串会失败。）

**下架**：
```bash
npm run prune        # dry-run：列出将会下架的死链条目
npm run prune:apply  # 同上（仍只列）；除非仓库变量 PRUNE_AUTO=1 才真实移入 removed/
```
或在仓库 `Settings → Secrets and variables → Actions → Variables` 设 `PRUNE_AUTO = 1`，
让每日 `prune.yml` 自动把死链移入 `removed/` 并提交（默认保守，不开则不删）。

---

## 写专题长文（editorial）

详情页是 `noindex` 的跳转页，**写正文不会被索引**；有观点的长文只能落在专题页。
新建 `src/content/editorial/<slug>.md`（Markdown，含正文），字段见 README 的「专题长文」一节。
要点：要有观点、有结构、每条引用都说明为什么值得点开；**不要写剧情简介**。

---

## 文件位置一览

| 路径 | 作用 |
|---|---|
| `src/content/<type>/*.json` | 短视频/漫画/小说条目（数据集合，id = 文件名） |
| `src/content/editorial/*.md` | 专题长文（Markdown，含正文，抗薄内容主力） |
| `data/pending/` | 采集/导入产出的待审核内容（不进构建） |
| `removed/` | 已下架/下线的归档（移入即触发重新部署下架） |

---

## 常见坑

1. **`coverUrl` 失效要整行删，不能置空串**——schema 是 `z.string().url()`，空串校验失败。
2. **`review` 为空进不了编辑精选**——有 `metrics` 就必须写，否则首页/列表的精选板块会缺这条。
3. **中文文件名（slug）**——URL 与 SEO 都受影响，CI 的 slugify `--scan` 会扫出，严禁。
4. **详情页不索引**——正文写在详情页白写；原创文本只投在列表卡片 `review` 与专题长文。
5. **推送前的两个自检脚本**是免费的保险，建议每次都跑。
