# Cloudflare R2 手动配置手册

> **本手册是可选的**：短视频封面存储支持自动降级——**未配置 R2 时，封面会自动落仓库 `public/covers/videos/`（`coverUrl` 记站内相对路径），零信用卡、零配置即可运行**。本手册仅在你想用 R2 做规模化存储时才需要照做；代码已就绪，配好即生效。

> 配套代码：
> - `scripts/lib/r2.mjs` —— 本地脚本 / CI 用（S3 兼容 API + AWS SigV4，零依赖）
> - `scripts/store-cover.mjs` —— 封面上传 CLI
> - `scripts/import.mjs` —— `STORE_COVERS=1` 时自动把封面搬到 R2
> - `functions/api/cover.ts` —— 第三方直传端点（`/api/cover`）
>
> 代码已全部落地，**配好下面 7 步即可生效**，无需改代码。

---

## 0. 这套方案用到哪两套凭证

R2 在本项目里有**两种访问方式**，必须分别配置：

| 用途 | 访问方式 | 需要什么 |
|---|---|---|
| **第三方直传端点** `POST /api/cover` | R2 **绑定**（运行时，函数自带桶句柄，无密钥） | Pages 绑定 `COVER` + 环境变量 `COVER_UPLOAD_TOKEN` + `R2_PUBLIC_URL` |
| **本地脚本 / CI**（`store-cover.mjs`、`import.mjs STORE_COVERS=1`） | R2 **S3 API 凭据**（代码用 SigV4 签名 PUT） | `R2_ACCOUNT_ID` / `R2_BUCKET` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` + `R2_PUBLIC_URL` |

> 两套互不冲突：直传端点用「绑定」，脚本/CI 用「凭据」。第三方**只需口令**，永远拿不到 R2 密钥。

---

## 1. 创建 R2 桶

1. 登录 <https://dash.cloudflare.com> → 左侧 **R2 Object Storage**。
2. 首次使用按提示开通（绑定信用卡，免费额度内不扣费）。
3. 点 **Create bucket**。
   - **Bucket name**：例如 `hublinks-covers`（记下这个名字，后面填 `R2_BUCKET`）。
   - **Location hint**：选离用户近的区（如 `APAC`，无强制）。
   - **Storage class**：默认 Standard。
4. 点 **Create**。

> 免费额度：**10 GB 存储 + 1M A 类 + 10M B 类操作 / 月，且出网费永远为 0**。封面是给每位访客看的，零出网费是选 R2 的核心原因。

---

## 2. 开启公开访问（拿到 `R2_PUBLIC_URL`）

封面要被网站 `<img>` 直接加载，桶必须可公开读。两种方式二选一：

### 方式 A：Public bucket（开箱即用，推荐先跑通）
1. 进入刚建的桶 → **Settings**。
2. 找到 **Public bucket access** → 点 **Allow Access**。
3. 开启后 Cloudflare 会给出形如 `https://<bucket>.r2.dev` 的公开地址。
4. 记下它 → 这就是 `R2_PUBLIC_URL` 的值。

### 方式 B：自定义域（生产推荐）
1. 桶 → **Settings** → **Custom Domains** → **Add a domain**。
2. 填一个已托管在 Cloudflare 的子域（如 `covers.your-domain.com`），开启 **Proxy**。
3. 生效后 `R2_PUBLIC_URL = https://covers.your-domain.com`。
4. 优点：走 Cloudflare CDN 缓存、无 `r2.dev` 速率限制、可用自家域名。

> ⚠️ `R2_PUBLIC_URL` 必须带 `https://` 协议，结尾**不要**带斜杠（代码会自动去掉尾斜杠并拼 `/videos/<slug>.jpg`）。

---

## 3. 创建 R2 API 令牌（S3 凭据）

给本地脚本 / CI 用的 SigV4 签名凭据。

1. R2 页面左侧 **Manage R2 API Tokens** → **Create API Token**。
2. 填写：
   - **Token name**：如 `aggregator-ci`。
   - **Permissions**：选 **Object Read & Write**（至少 Read+Write）。
   - **Specify bucket**：选刚建的桶 `hublinks-covers`（或选 All buckets，权限更宽）。
   - **TTL**：建议不设过期（No expiration），避免 CI 突然失效；如需轮换可设 1 年。
3. 点 **Create**。
4. 页面会显示：
   - **Access Key ID** → 填 `R2_ACCESS_KEY_ID`
   - **Secret Access Key** → 填 `R2_SECRET_ACCESS_KEY`（**只显示一次，立即复制保存**）

> 在 R2 概览页或任意桶页面顶部，也能看到你的 **Account ID**（24 位十六进制）→ 填 `R2_ACCOUNT_ID`。

---

## 4. 在 Pages 绑定 R2 桶（供直传端点）

这一步让 `functions/api/cover.ts` 运行时能拿到 `env.COVER` 桶句柄。

1. 进入 **Workers & Pages** → 你的 Pages 项目（如 `content-aggregator`）→ **Settings** → **Bindings**。
2. 点 **Add** → 选 **R2 bucket**（若列表里没有，选 **Add binding** 再选类型）。
3. 填写：
   - **Variable name**：必须填 **`COVER`**（代码里写死读 `env.COVER`，改了函数就拿不到桶）。
   - **R2 bucket**：选 `hublinks-covers`。
4. 点 **Save / Deploy**。

> 修改绑定后，需一次新的部署才生效（下一次 `git push` 自动触发；也可在 deployments 里手动 Retry 最近一次）。

---

## 5. 在 Pages 设置环境变量（Functions 用）

给直传端点返回公开 URL 和校验口令。

1. 项目 → **Settings** → **Environment variables**。
2. 在 **Production** 下添加两条：
   - `R2_PUBLIC_URL` = `https://<bucket>.r2.dev`（或自定义域，同第 2 步）
   - `COVER_UPLOAD_TOKEN` = 一个**长随机串**（生成示例：`openssl rand -hex 32`）
3. 保存。

> `COVER_UPLOAD_TOKEN` 是第三方调用 `/api/cover` 的口令，务必够长够随机，不要在代码或公开仓库泄露。第三方持有它**只能上传封面**，拿不到 R2 密钥、不能删桶。

---

## 6. 在 GitHub 配置 Secrets（CI 用）

让 `npm run harvest` / `import` 在 CI 里能调 R2 S3 API（`store-cover.mjs`、`STORE_COVERS=1`）。

1. GitHub 仓库 → **Settings** → **Secrets and variables** → **Actions**。
2. 点 **New repository secret**，逐条添加：

| Secret 名 | 值 |
|---|---|
| `R2_ACCOUNT_ID` | 第 3 步拿到的账户 ID |
| `R2_BUCKET` | 桶名，如 `hublinks-covers` |
| `R2_ACCESS_KEY_ID` | 第 3 步 Access Key ID |
| `R2_SECRET_ACCESS_KEY` | 第 3 步 Secret Access Key |
| `R2_PUBLIC_URL` | `https://<bucket>.r2.dev`（或自定义域，同第 2 步） |

3. 这些值在 CI 里会被注入为环境变量，`r2.mjs` 自动识别 `isR2Configured()` 为 true。

> 不配 Secrets 也不会崩：CI 跑 harvest 时 `isR2Configured()` 为 false，封面逻辑优雅降级（漫画/小说本就走外链；短视频若 CI 想自动存封面就必须配）。

---

## 7. 验证（配完即测）

### A. 本地脚本直传（需先 export 第 3/6 步的 5 个变量）
```bash
export R2_ACCOUNT_ID=xxxx
export R2_BUCKET=hublinks-covers
export R2_ACCESS_KEY_ID=xxxx
export R2_SECRET_ACCESS_KEY=xxxx
export R2_PUBLIC_URL=https://hublinks-covers.r2.dev

node scripts/store-cover.mjs https://example.com/some-cover.jpg my-test --apply
```
预期输出：`https://hublinks-covers.r2.dev/videos/my-test.jpg`
打开该 URL，应能看到图。

### B. 第三方直传端点（部署后）
```bash
curl -X POST https://<你的Pages域名>/api/cover \
  -H "x-cover-token: <COVER_UPLOAD_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://.../cover.jpg","slug":"my-video"}'
```
预期返回：
```json
{ "ok": true, "url": "https://<bucket>.r2.dev/videos/my-video.jpg", "key": "videos/my-video.jpg" }
```
把返回 `url` 填进视频 JSON 的 `coverUrl` 即可。

### C. import 自动存封面
```bash
STORE_COVERS=1 node scripts/import.mjs
```
（仅当导入的视频条目带外链 `coverUrl`、且 R2 已配置时，会自动搬图并替换为 R2 URL；失败回退原外链，不阻断导入。）

---

## 8. 变量总对照表

| 名称 | 类型 | 用在哪 | 取值 |
|---|---|---|---|
| `COVER` | Pages R2 绑定 | `functions/api/cover.ts` | 变量名固定 `COVER`，绑到封面桶 |
| `COVER_UPLOAD_TOKEN` | Pages 环境变量 | `cover.ts` 鉴权 | 长随机串 |
| `R2_PUBLIC_URL` | Pages 环境变量 **+** GitHub Secret | 函数返回 URL / 脚本拼 URL | `https://<bucket>.r2.dev` 或自定义域 |
| `R2_ACCOUNT_ID` | GitHub Secret | `r2.mjs` SigV4 | 账户 ID |
| `R2_BUCKET` | GitHub Secret | `r2.mjs` | 桶名 |
| `R2_ACCESS_KEY_ID` | GitHub Secret | `r2.mjs` | API 令牌 Access Key |
| `R2_SECRET_ACCESS_KEY` | GitHub Secret | `r2.mjs` | API 令牌 Secret |

---

## 9. 踩坑 / 注意事项清单

- **`R2_PUBLIC_URL` 必须带 `https://` 且无尾斜杠**。代码用 `replace(/\/+$/,'')` 去尾斜杠，但前导协议必须有，否则拼出 `videos/...` 这种坏链。
- **绑定变量名必须叫 `COVER`**。`cover.ts` 里写死 `env.COVER`，改名函数返回 503 `cover storage not configured`。
- **改 Bindings / 环境变量后要重新部署一次**才生效（绑定时点 Save 会提示 Deploy；否则等下次 `git push`）。
- **Public bucket（`.r2.dev`）有速率限制**，官方建议生产用自定义域。量小无所谓，量大请走第 2 步方式 B。
- **桶名区分大小写且与 `R2_BUCKET` 一致**；S3 API 的桶名错误会返回 `NoSuchBucket`。
- **API 令牌权限至少 Object Read & Write**；只给 Read 会导致 `store-cover` 返回 403。
- **key 路径前缀是代码硬编码的 `videos/`**（`store-cover` / `cover.ts` 统一写成 `videos/<slug>.<ext>`）。第三方传 `slug` 时不要带 `/` 或路径，否则会写出嵌套 key。
- **每日失效巡检仍会检查 R2 封面**：`check-links.js` 对 `http(s)` 开头的 `coverUrl` 做可达性检查，失效则清空 `coverUrl` 回退默认图。所以 `coverUrl` 必须填**真实可访问**的 R2 地址。
- **漫画 / 小说封面不走 R2**，仍用原站外链（link index 不变）；只有短视频封面走 R2。
- **`COVER_UPLOAD_TOKEN` 泄漏风险面小**：持口令只能 `PUT` 封面到固定前缀，不能列桶、不能删、拿不到密钥。建议定期 `openssl rand -hex 32` 轮换。
- **本地 `store-cover` 无凭据时** `isR2Configured()` 为 false，脚本会打印提示并不上传——这是预期降级，不是报错。
