# 待审核队列（data/pending/）

自动采集（`scripts/harvest.mjs`）与半自动导入（`scripts/import.mjs`）产出的内容
**只落盘到这里**，不会直接进入 `src/content/`。

## 流程

1. 定时任务 / 手动运行 `npm run harvest` → 各平台榜单 TOP 内容写入本目录。
2. 人工打开文件，核对：**作者、封面、是否正版、是否仍在架**。
3. 确认无误后运行 `npm run promote`（`--apply` 实际移动）晋升到 `src/content/`。
4. 之后 `npm run build` 才会把它们纳入站点与跳转。

## 为什么不直接上线

- 自动解析可能出错（站改版 / 误抓非内容页）；
- 版权安全：正版平台也可能出现下架 / 转授权内容，需人工兜底；
- 合规：所有外链必须落在白名单主机内（见 `scripts/lib/sources.mjs`）。

## 反爬平台（番茄小说 / 漫客栈）

这两家反爬较强，不进自动采集。请用半自动导入：

1. 编辑 `data/import.json`（参照 `data/import.example.json`）；
2. `npm run import`。
