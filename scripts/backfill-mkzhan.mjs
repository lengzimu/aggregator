// 用漫客栈官方 API 回填「已收录」mkzhan 条目的衍生字段：
// 题材(tags) / 连载状态(status) / 封面(coverUrl) / 评分与阅读数(metrics) / 推荐语(review)。
// 只更新这些字段，保留原有 title / sourceUrl / pubDate / sourceId，避免覆盖策划信息。
//
// 用法：
//   node scripts/backfill-mkzhan.mjs          # dry-run（仅统计，不写盘）
//   node scripts/backfill-mkzhan.mjs --apply   # 写回 src/content/comics/mkzhan-*.json
import { mkzhan } from './lib/adapters.mjs';
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'src/content/comics';
const APPLY = process.argv.includes('--apply');

const items = await mkzhan();
const bySlug = new Map(items.map((it) => [it.slug, it]));

const files = fs.readdirSync(DIR).filter((f) => f.startsWith('mkzhan-') && f.endsWith('.json'));
let updated = 0;
let skipped = 0;
for (const f of files) {
  const slug = f.replace(/\.json$/, '');
  const enriched = bySlug.get(slug);
  if (!enriched) {
    skipped++;
    continue;
  }
  const p = path.join(DIR, f);
  const cur = JSON.parse(fs.readFileSync(p, 'utf8'));
  const nf = enriched.frontmatter;
  cur.tags = nf.tags;
  if (nf.coverUrl) cur.coverUrl = nf.coverUrl;
  cur.status = nf.status;
  if (nf.author) cur.author = nf.author;
  cur.metrics = { ...(cur.metrics || {}), ...nf.metrics };
  cur.review = nf.review;
  if (APPLY) fs.writeFileSync(p, JSON.stringify(cur, null, 2) + '\n');
  updated++;
  if (!APPLY && updated <= 3)
    console.log(`[dry] ${slug} → 题材 ${nf.tags.join('/') || '-'} | 状态 ${nf.status} | 封面 ${nf.coverUrl ? '有' : '无'}`);
}

console.log(APPLY ? `已写回 ${updated} 条 mkzhan 条目（跳过 ${skipped} 条未匹配）` : `[dry-run] 将更新 ${updated} 条，跳过 ${skipped} 条未匹配`);
