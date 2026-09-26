# DMCA 自动下架（方案 B：自动下架 + 防刷）配置清单

> 适用场景：希望通过 `/api/dmca` 端点让举报**自动下架并清理封面**，但又担心被 Bot 批量刷导致误删。
> 本方案在「自动下架」基础上叠加 **Turnstile 人机验证 + 单 IP 频率限制** 两道防线，
> 端点代码（`functions/api/dmca.ts`）与表单（`src/components/DmcaForm.astro`）已内置支持，本清单只讲 Cloudflare 控制台怎么配。

---

## 0. 先看：GITHUB_TOKEN 现在到底配了没？

Cloudflare 侧环境变量我（AI）看不到，需要你亲自在控制台确认：

1. 打开 <https://dash.cloudflare.com>
2. 左侧 **Workers & Pages** → 你的项目（项目名 `content-aggregator` 或 `aggregator`）
3. 进入项目 → 顶部 **Settings** 标签
4. 左侧 **Environment variables**（环境变量）
5. 变量列表里有没有 `GITHUB_TOKEN` 这一行？
   - **有** → 端点会**自动下架**。此时若 Turnstile / KV 还没配，相当于「裸奔自动删」，请尽快补 §2、§3。
   - **没有** → 当前走 fallback 工单模式（返回 `fallback:true`，不删任何数据，只弹 GitHub 工单）。配完 §1 才会自动删。

> 注意：此处的 `GITHUB_TOKEN` 是**你配在 Cloudflare 上的环境变量**，和 GitHub Actions 自动注入的那个 `GITHUB_TOKEN` 不是一回事。

---

## 1. GitHub PAT（GITHUB_TOKEN 的取值来源）

1. GitHub → 头像 → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. **Generate new token (classic)**，勾选 **`repo`** scope（含 `contents: write`）
3. 复制生成的 `ghp_xxx`
4. 回到 Cloudflare **Environment variables** → **Add variable**：
   - `GITHUB_TOKEN` = `ghp_xxx`（建议点 **Encrypt** 加密）
   - `GITHUB_REPO` = `lengzimu/aggregator`（你的 owner/repo）

---

## 2. Cloudflare Turnstile（人机验证，挡住 Bot）

1. 左侧栏 **Turnstile** → **Add Site**
   - Site name：随意
   - Domain：填你的站点域名（如 `aggregator-9w7.pages.dev`，或你的自定义域）
2. 创建后拿到 **Site Key** 与 **Secret Key**
3. Cloudflare **Environment variables** → **Add variable**：
   - `PUBLIC_TURNSTILE_SITE_KEY` = Site Key（会下发到浏览器 JS，所以前缀是 PUBLIC）
   - `TURNSTILE_SECRET_KEY` = Secret Key（仅服务端用，建议 Encrypt）

> 配完后 `/dmca/` 表单底部会自动出现 Turnstile 验证框；端点侧 `if (env.TURNSTILE_SECRET_KEY)` 分支会校验，没配则跳过（兼容）。

---

## 3. KV 频率限制（单 IP 限流，兜底防刷）

1. 左侧栏 **Workers & Pages** → **KV** → **Create a namespace**，命名随意（如 `dmca-rate-limit`），记下返回的 ID
   - 或用 CLI：`npx wrangler kv namespace create RATE_LIMIT_KV`
2. 回到项目 → **Settings** → **Functions** → **KV namespace bindings** → **Add binding**：
   - Variable name：`RATE_LIMIT_KV`
   - 绑定到刚建的 namespace
3. （可选）**Environment variables** 再加微调：
   - `RATE_LIMIT_MAX` = `5`（每窗口最大提交数，默认 5）
   - `RATE_LIMIT_WINDOW_SEC` = `3600`（窗口秒数，默认 3600 = 1 小时）

> 没绑 KV 时端点自动跳过限流（优雅降级）；绑了之后单 IP 每窗口最多 `RATE_LIMIT_MAX` 次，超额返回 429。

---

## 4. 生效与自检

- 环境变量改动：git push 后自动生效（Cloudflare Pages 重新部署）。
- KV binding：控制台即时生效，下次请求即启用。
- 端点行为矩阵：

| GITHUB_TOKEN | TURNSTILE | RATE_LIMIT_KV | 结果 |
|---|---|---|---|
| 未配 | 任意 | 任意 | 只开 GitHub 工单，**不删数据**（最安全兜底） |
| 已配 | 未配 | 未绑 | **裸奔自动删**（危险，尽快补下两项） |
| 已配 | 已配 | 已绑 | 真人每 IP 每小时最多下架 5 条，Bot 被验证挡在门外 ✅ |

- 验证方法：打开 `/dmca/`，应看到 Turnstile 验证框；提交一条真实举报 → 提示「已进入下架流程」，对应条目几分钟后从列表消失（封面也被清）。

---

## 5. 为什么方案 B 不会「批量误删」

- **单条路径校验**：服务端 `parsePageUrl` 只允许 `/videos|comics|novels/<slug>/` 形式，一次提交 = 解析出一个 slug = 移动一个 JSON 文件。**没有整站 / 通配 / 批量入口**。
- **四重防护**：隐藏蜜罐字段 + 字段级校验 + Turnstile 人机验证 + 单 IP 限流。
- **即便全开**：单 IP 1 小时最多 5 条，Bot 被 Turnstile 拦在门外，真人不可能手填几百次，不可能批量误删。
- 卡片上的「举报」链接只是预填一个文本框，**不会自动提交**，不存在「点一下删一页」。

---

## 相关文件

- `functions/api/dmca.ts`：端点逻辑（Turnstile 校验 / KV 限流 / GitHub 移动文件 / 封面清理）
- `src/components/DmcaForm.astro`：表单（Turnstile widget、`?page=` 预填、429 文案）
- `wrangler.toml`：KV binding 注释说明（生产建议在控制台绑定）
- `docs/THIRD_PARTY_PUSH.md`：第三方推送与下架回流协议
