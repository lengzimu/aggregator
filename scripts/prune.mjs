// 自动下架（存活巡检）：回抓每个已上线条目的源站，判断内容是否还在。
//
//   node scripts/prune.mjs            # dry-run：只列出将会下架的条目
//   node scripts/prune.mjs --apply    # 真实下架：dead 条目移入 removed/<collection>/
//
// 判定（见 lib/review.mjs classifyLiveness）：
//   - 404 / 410，或页面明确"已下架/已删除" → dead → 移入 removed/（重建后 302 与卡片自动消失）
//   - 403 / 429 / 超时 / 网络错            → ambiguous → 跳过，不删（绝误杀）
//
// 设计取舍：
//   - 下架 = 移动到 removed/（而非硬删），与 DMCA 表单下架走同一归档目录，可 git 还原。
//   - 只在 src/content/ 中巡检；removed/ 与 pending/ 不参与。
//   - 主机不在白名单内的条目无法可靠验证，直接跳过。
// 2026-09 起内容为 JSON 数据文件，直接用 JSON.parse / toJson。
// JSON 数据文件直接用 JSON.parse / toJson，无需 markdown 解析器
import { readdir, readFile, rename, mkdir, writeFile, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isWhitelistedHost } from './lib/sources.mjs';
import { classifyLiveness } from './lib/review.mjs';
import { toJson } from './lib/markdown.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
// 脚本位于 scripts/，距仓库根 1 层
const ROOT = join(__dirname, '..');
const AUTO = process.env.PRUNE_AUTO === '1';
// 真实下架需同时满足：传入 --apply 且 PRUNE_AUTO=1。否则一律 dry-run。
const APPLY = process.argv.includes('--apply') && AUTO;
if (process.argv.includes('--apply') && !AUTO) {
  console.log('[prune] PRUNE_AUTO 未开启（非 "1"），--apply 被忽略，本次仅做 dry-run 演习。');
}

const COLLECTIONS = ['videos', 'comics', 'novels'];
const CONCURRENCY = 4; // 同时最多 4 个请求，避免打爆源站
const PER_HOST_DELAY = 400; // 同主机请求间隔（ms），礼貌限速
const TIMEOUT = 15000; // 单次请求超时（ms）
const UA =
  'Mozilla/5.0 (compatible; HubLinksPrune/1.0; +https://example.com)';

const hostLastHit = new Map();
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
async function politeDelay(url) {
  let host = '';
  try {
    host = new URL(url).host;
  } catch {
    return;
  }
  const last = hostLastHit.get(host) || 0;
  const wait = Math.max(0, PER_HOST_DELAY - (Date.now() - last));
  if (wait) await sleep(wait);
  hostLastHit.set(host, Date.now());
}

async function fetchLiveness(url) {
  await politeDelay(url);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    let body = '';
    try {
      body = await res.text();
    } catch {
      /* 读 body 失败不影响状态码判定 */
    }
    return { status: res.status, body };
  } catch {
    // 网络错 / 超时（AbortError）→ 视为无法判定
    return { status: 0, body: '', error: true };
  } finally {
    clearTimeout(timer);
  }
}

const stats = { checked: 0, dead: 0, removed: 0, ambiguous: 0, skipped: 0 };

async function pruneEntry(col, file) {
  const srcPath = join(ROOT, 'src', 'content', col, file);
  const text = await readFile(srcPath, 'utf8');
  const data = JSON.parse(text);
  const url = data.sourceUrl;

  if (!url || !isWhitelistedHost(data.platform, url)) {
    stats.skipped++;
    console.log(`SKIP  ${col}/${file} (无 sourceUrl 或主机不在白名单，无法验证)`);
    return;
  }

  const { status, body } = await fetchLiveness(url);
  const verdict = classifyLiveness({ status, body });
  stats.checked++;

  if (verdict === 'alive') {
    return; // 正常，静默保留
  }
  if (verdict === 'ambiguous') {
    stats.ambiguous++;
    console.log(`AMBG  ${col}/${file} (HTTP ${status}：无法判定，跳过不删)`);
    return;
  }

  // dead → 下架
  stats.dead++;
  const removedDir = join(ROOT, 'removed', col);
  const removedPath = join(removedDir, file);
  if (APPLY) {
    const updated = toJson({
      ...data,
      takedownReason: 'dead-source',
      takedownDate: new Date().toISOString().slice(0, 10),
      takedownMethod: 'auto-prune',
    });
    await mkdir(removedDir, { recursive: true });
    await writeFile(removedPath, updated, 'utf8');
    await unlink(srcPath);
    stats.removed++;
  }
  console.log(
    `${APPLY ? 'RM   ' : 'WOULD'} ${col}/${file} (HTTP ${status}：源站已下架/删除)`,
  );
}

async function runPool(tasks) {
  let i = 0;
  async function worker() {
    while (i < tasks.length) {
      const task = tasks[i++];
      await pruneEntry(task.col, task.file);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

async function main() {
  const tasks = [];
  for (const col of COLLECTIONS) {
    let files;
    try {
      files = (await readdir(join(ROOT, 'src', 'content', col))).filter((f) =>
        f.endsWith('.json'),
      );
    } catch {
      continue;
    }
    for (const f of files) tasks.push({ col, file: f });
  }

  if (!tasks.length) {
    console.log('无已上线条目，无需巡检。');
    return;
  }

  await runPool(tasks);

  console.log('\n==== 巡检汇总 ====');
  console.log(`已检查    : ${stats.checked}`);
  console.log(`应下架    : ${stats.dead}`);
  console.log(`本次已移除: ${stats.removed}`);
  console.log(`无法判定  : ${stats.ambiguous}（已跳过，不删）`);
  console.log(`已跳过    : ${stats.skipped}（无 URL / 主机不在白名单）`);
  if (!APPLY && stats.dead > 0) {
    console.log('\n（dry-run）加 --apply 执行真实下架。');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
