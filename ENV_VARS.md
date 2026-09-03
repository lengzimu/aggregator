# 环境变量与绑定清单（Cloudflare Pages 上线用）

本站所有「站点级真实配置」都通过环境变量注入，**不写死在代码里**。本文件是一份可直接对照填写的清单。

---

## 一、在哪里配置

### Cloudflare Pages 控制台 → 你的项目 → Settings
- **Environment variables**：填下面的 **A 组**（建议 Production 与 Preview 两个作用域都填）。
- **Functions → KV namespace bindings**：填下面的 **B 组**（KV 绑定，不是普通环境变量）。

### 本地开发
- 前端 `PUBLIC_*` 变量：放项目根 `.env`（Astro / Vite 自动读取）。
- Function 运行时密钥：放 `.dev.vars`（wrangler 本地文件，通常已被 gitignore，**勿提交真实值**），配合 `wrangler pages dev` 使用。
- KV 本地绑定：见仓库根 `wrangler.toml`（默认注释，启用限流时取消注释并填入命名空间 id）。

---

## 二、A 组：Environment variables

> 带 `PUBLIC_` 前缀的变量会暴露到前端构建产物；**保密类变量一律不要加 `PUBLIC_` 前缀**，否则会泄漏到浏览器。

### 公开变量（`PUBLIC_*` —— 前端构建需要，可暴露）

| 变量名 | 必填 | 作用域 | 默认值 | 说明 / 示例 |
| --- | --- | --- | --- | --- |
| `PUBLIC_SITE_URL` | 建议 | build | `https://example.com` | 真实域名，用于生成 canonical / OG / sitemap。`https://your-domain.com` |
| `PUBLIC_DMCA_EMAIL` | 建议 | build | `dmca@example.com` | DMCA 投诉接收邮箱，注入到 DMCA 文案。`dmca@your-domain.com` |
| `PUBLIC_AFFILIATE_URL` | 否 | build | Amazon 占位链接 | 联盟营销链接。`https://www.amazon.com/?tag=YOUR-TAG-20` |
| `PUBLIC_AFFILIATE_LABEL` | 否 | build | `Amazon Associates` | 联盟名称展示。`Amazon Associates` |
| `PUBLIC_DMCA_REPO` | 否（兜底用） | build | 空 | 未配置下架后端时，表单自动打开预填 GitHub Issue 的仓库 `owner/repo` |
| `PUBLIC_DMCA_ENDPOINT` | 否 | build | `/api/dmca` | 覆盖 DMCA 下架端点路径 |
| `PUBLIC_TURNSTILE_SITE_KEY` | 否（CAPTCHA） | build | 空 | Turnstile 站点密钥；**配置了才显示验证挂件** |
| `PUBLIC_GSC_VERIFICATION` | 否（SEO） | build | 空 | Google Search Console 验证字符串；配了才在 `<head>` 输出 `google-site-verification` |
| `PUBLIC_BING_VERIFICATION` | 否（SEO） | build | 空 | Bing Webmaster Tools 验证字符串；配了才输出 `msvalidate.01` |
| `PUBLIC_ADSENSE_CLIENT` | 否（广告） | build | 空 | Google AdSense 发布商 ID（`ca-pub-...`）；配了才注入 AdSense 脚本与广告位 |
| `PUBLIC_ADSENSE_SLOT` | 否（广告） | build | 空 | 默认 AdSense 插槽 ID；各 `<AdSlot>` 也可单独传 `slot` 覆盖 |

### 保密 / 配置变量（**不要**加 `PUBLIC_` 前缀 —— 仅 Function 运行时读取）

| 变量名 | 必填 | 作用域 | 默认值 | 说明 / 示例 |
| --- | --- | --- | --- | --- |
| `GITHUB_TOKEN` | 否（直接下架用） | runtime (Functions) | 空 | 具备 repo 写权限的 token（`contents: write`），用于 DMCA 直接下架 |
| `GITHUB_REPO` | 否（直接下架用） | runtime (Functions) | 空 | 仓库坐标 `owner/repo` |
| `TURNSTILE_SECRET_KEY` | 否（CAPTCHA） | runtime (Functions) | 空 | Turnstile 密钥；配置了才校验 token |
| `RATE_LIMIT_MAX` | 否（限流） | runtime (Functions) | `5` | 单窗口内允许的最大请求数（最小 1） |
| `RATE_LIMIT_WINDOW_SEC` | 否（限流） | runtime (Functions) | `3600` | 限流窗口长度（秒，最小 60） |

---

## 三、B 组：KV 绑定（不是环境变量）

| 绑定名 (Variable name) | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `RATE_LIMIT_KV` | KV namespace | 否 | IP 限流的计数存储。**不绑定则限流自动跳过**，不影响其他功能 |

创建并绑定：
```bash
npx wrangler kv namespace create RATE_LIMIT_KV
# 在 Cloudflare 控制台 → Pages → 项目 → Settings → Functions → KV namespace bindings
# 添加：Variable name = RATE_LIMIT_KV，指向刚创建的命名空间
```

---

## 四、功能开关矩阵（哪些变量一起决定某功能是否生效）

| 功能 | 生效条件 | 未满足时的行为 |
| --- | --- | --- |
| **DMCA 直接下架** | `GITHUB_TOKEN` + `GITHUB_REPO` 都配置 | 前端改用 `PUBLIC_DMCA_REPO` 预填 GitHub Issue 兜底（需配置该变量） |
| **Turnstile CAPTCHA** | `PUBLIC_TURNSTILE_SITE_KEY`（前端挂件）+ `TURNSTILE_SECRET_KEY`（后端校验）**都配置** | 两者都缺 → 完全跳过验证；只配一个 → 提交会报 422（前端要 token、后端校验失败） |
| **IP 频率限制** | 绑定 `RATE_LIMIT_KV` | 不绑定 → 跳过限流；可选 `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_SEC` 调阈值 |

> 设计原则：**每个增强项都是「配置即生效，缺省则优雅降级」**，任何一项没配都不会让站点崩溃。

---

## 五、最小可上线配置

如果只做纯链接索引、暂不用下架 / 验证码 / 限流，只需填：

```
PUBLIC_SITE_URL=https://your-domain.com
PUBLIC_DMCA_EMAIL=dmca@your-domain.com
# 可选：
PUBLIC_AFFILIATE_URL=https://www.amazon.com/?tag=YOUR-TAG-20
PUBLIC_AFFILIATE_LABEL=Amazon Associates
```

其他变量按需叠加即可。

---

## 六、本地开发文件示例

**`.env`**（前端 PUBLIC_ 变量，已被 gitignore 最佳）：
```bash
PUBLIC_SITE_URL=http://127.0.0.1:4321
PUBLIC_DMCA_EMAIL=dmca@localhost
PUBLIC_AFFILIATE_URL=https://www.amazon.com/?tag=YOUR-TAG-20
PUBLIC_AFFILIATE_LABEL=Amazon Associates
```

**`.dev.vars`**（Function 运行时密钥，wrangler 本地文件，**勿提交**）：
```bash
GITHUB_TOKEN=ghp_xxx
GITHUB_REPO=owner/repo
TURNSTILE_SECRET_KEY=0x4XXXXXXXxxxxxxxxxxxx
RATE_LIMIT_MAX=5
RATE_LIMIT_WINDOW_SEC=3600
```

---

## 七、CI（GitHub Actions）

`harvest.yml` / `prune.yml` 使用仓库自带的 `GITHUB_TOKEN`（GitHub 自动注入），**无需额外配置 secret**。

### CI 行为开关（GitHub Actions Repository Variables，非 secret）

这两个变量在仓库 `Settings → Secrets and variables → Actions → Variables` 新建，**不填则保持安全默认**：

| 变量名 | 默认值 | 作用 | 未设置时的行为 |
| --- | --- | --- | --- |
| `AUTO_PROMOTE` | 未设 | `harvest.yml` 采集后是否自动晋升"置信可过"的 pending 条目 | 设为 `1` 才执行 auto-promote；否则只提交 pending，全人工复核 |
| `PRUNE_AUTO` | 未设 | `prune.yml` 巡检到 dead 条目时是否真实下架 | 设为 `1` 才真实移动（带 `--apply`）；否则 `prune.mjs` 强制 dry-run，只输出报告不删文件 |

> 二者设计一致：**默认都只"采集/巡检"、不"上线/下架"**，避免任何无人值守的自动发布或自动删除。需要时才显式打开对应开关。



---

## 八、完整清单（一键对照）

公开（Production + Preview 都填）：
```
PUBLIC_SITE_URL
PUBLIC_DMCA_EMAIL
PUBLIC_AFFILIATE_URL        # 可选
PUBLIC_AFFILIATE_LABEL      # 可选
PUBLIC_DMCA_REPO            # 可选（兜底工单）
PUBLIC_DMCA_ENDPOINT        # 可选
PUBLIC_TURNSTILE_SITE_KEY   # 可选（CAPTCHA）
PUBLIC_GSC_VERIFICATION      # 可选（SEO/Google 收录）
PUBLIC_BING_VERIFICATION     # 可选（SEO/Bing 收录）
PUBLIC_ADSENSE_CLIENT        # 可选（AdSense 手动插槽）
PUBLIC_ADSENSE_SLOT          # 可选（AdSense 默认插槽）
```

保密（Functions 运行时，勿加 PUBLIC_ 前缀）：
```
GITHUB_TOKEN                # 可选（直接下架）
GITHUB_REPO                 # 可选（直接下架）
TURNSTILE_SECRET_KEY        # 可选（CAPTCHA）
RATE_LIMIT_MAX              # 可选（限流）
RATE_LIMIT_WINDOW_SEC       # 可选（限流）
```

KV 绑定（Settings → Functions → KV）：
```
RATE_LIMIT_KV               # 可选（限流）
```
