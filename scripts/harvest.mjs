// 采集主入口：遍历 SOURCES → 调适配器 → 跳过已收录 → 热度门槛过滤 → 白名单校验 → 写 data/pending/
//
// 用法：
//   node scripts/harvest.mjs                 # 全部可自动采集的平台
//   node scripts/harvest.mjs --only webtoon  # 只跑某个平台
//   DRY=1 node scripts/harvest.mjs           # 只打印，不写盘
//
// 注意：短视频（抖音/TikTok）不在此列——其平台禁止抓取，需人工录入。
import { SOURCES } from './lib/sources.mjs';
import { ADAPTERS } from './lib/adapters.mjs';
import { toJson, writePending } from './lib/markdown.mjs';
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const COLLECTIONS = ['videos', 'comics', 'novels'];

const only = process.argv.includes('--only')
  ? process.argv[process.argv.indexOf('--only') + 1]
  : null;
const DRY = process.env.DRY === '1';

/** 归一化 URL：去协议、去 www、去末尾斜杠、小写（与 dedupe.mjs 对齐），用于判重 */
function normUrl(s) {
  try {
    const u = new URL(String(s));
    const host = u.host.replace(/^www\./, '');
    return (host + u.pathname).replace(/\/+$/, '').toLowerCase();
  } catch {
    return String(s ?? '').trim().toLowerCase();
  }
}
const normId = (s) => String(s ?? '').trim().toLowerCase();

/** 预载 src/content 中已收录作品的归一化 sourceUrl / sourceId，避免重复录入（尤其策划过的作品） */
async function loadExistingKeys() {
  const urls = new Set();
  const ids = new Set();
  for (const col of COLLECTIONS) {
    let files;
    try {
      files = (await readdir(join(ROOT, 'src', 'content', col))).filter((f) => f.endsWith('.json'));
    } catch {
      continue;
    }
    for (const f of files) {
      try {
        const d = JSON.parse(await readFile(join(ROOT, 'src', 'content', col, f), 'utf8'));
        if (d.sourceUrl) urls.add(normUrl(d.sourceUrl));
        if (d.sourceId) ids.add(normId(d.sourceId));
      } catch {
        /* 跳过坏文件 */
      }
    }
  }
  return { urls, ids };
}

/** 是否满足"高点击 / 高评分 / 快增长"门槛（满足其一即保留） */
function passesThreshold(it, src) {
  const t = src.threshold || {};
  const m = it.frontmatter.metrics || {};
  if (t.maxRank && m.rank && m.rank > t.maxRank) return false;
  const ok =
    (t.maxRank && m.rank && m.rank <= t.maxRank) ||
    (t.minRating && m.rating && m.rating >= t.minRating) ||
    (t.minViews && m.views && m.views >= t.minViews) ||
    (t.minGrowth && m.growth && m.growth >= t.minGrowth);
  return !!ok;
}

function hostOf(url) {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** 域名白名单校验——版权安全核心，杜绝盗版站入库 */
function isWhitelisted(it, src) {
  const host = hostOf(it.frontmatter.sourceUrl);
  if (!host) return false;
  return src.hosts.some((h) => host === h || host.endsWith('.' + h));
}

async function main() {
  const existing = await loadExistingKeys();
  const report = [];
  for (const src of SOURCES) {
    if (only && src.key !== only) continue;
    if (src.tier === 'manual') {
      report.push({ source: src.key, status: 'skipped', reason: 'manual-import' });
      continue;
    }
    try {
      const raw = await ADAPTERS[src.adapter](src);
      // 跳过已收录作品（sourceUrl / sourceId 命中），避免重复录入策划过的条目
      let dupSkipped = 0;
      const fresh = raw.filter((it) => {
        const fm = it.frontmatter;
        const u = fm.sourceUrl ? normUrl(fm.sourceUrl) : '';
        const id = fm.sourceId ? normId(fm.sourceId) : '';
        if ((u && existing.urls.has(u)) || (id && existing.ids.has(id))) {
          dupSkipped++;
          return false;
        }
        return true;
      });
      const kept = fresh
        .filter((it) => passesThreshold(it, src))
        .filter((it) => isWhitelisted(it, src));
      const rejected = fresh.length - kept.length;
      for (const it of kept) {
        const md = toJson(it.frontmatter);
        if (!DRY) await writePending(src.collection, it.slug, md);
      }
      report.push({
        source: src.key,
        fetched: raw.length,
        dupSkipped,
        kept: kept.length,
        rejected,
        pendingDir: `data/pending/${src.collection}/`,
      });
    } catch (e) {
      report.push({ source: src.key, status: 'error', error: e.message });
    }
  }
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
