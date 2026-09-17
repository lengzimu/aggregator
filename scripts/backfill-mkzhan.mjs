// 用漫客栈官方 API 回填「已收录」mkzhan 条目的衍生字段：
// 标题(去「漫画」后缀) / 题材(tags) / 连载状态(status) / 封面(coverUrl) /
// 评分与阅读数(metrics) / 内容简介(description) / 最新章节名(latestChapter) /
// 最新章节开始时间(latestChapterAt) / 推荐语(review)。
// 保留原有 sourceUrl / pubDate / sourceId，避免覆盖策划信息。
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
  const p = path.join(DIR, f);
  const cur = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!enriched) {
    skipped++;
    // 未匹配到接口数据时，至少把标题末尾的「漫画」后缀清掉（旧 HTML 采集遗留）
    if (/漫画+$/.test(cur.title)) {
      const t = cur.title.replace(/漫画+$/g, '').trim();
      if (t) {
        cur.title = t;
        if (APPLY) fs.writeFileSync(p, JSON.stringify(cur, null, 2) + '\n');
        console.log(`[title] ${slug} 标题清理 → ${t}`);
      }
    }
    continue;
  }
  const nf = enriched.frontmatter;
  if (nf.title) cur.title = nf.title; // 接口标题干净（无「漫画」后缀）
  cur.tags = nf.tags;
  if (nf.coverUrl) cur.coverUrl = nf.coverUrl;
  cur.status = nf.status;
  if (nf.author) cur.author = nf.author;
  cur.metrics = { ...(cur.metrics || {}), ...nf.metrics };
  cur.review = nf.review;
  if (nf.description) cur.description = nf.description;
  if (nf.latestChapter) cur.latestChapter = nf.latestChapter;
  if (nf.latestChapterAt) cur.latestChapterAt = nf.latestChapterAt;
  if (APPLY) fs.writeFileSync(p, JSON.stringify(cur, null, 2) + '\n');
  updated++;
  if (!APPLY && updated <= 3)
    console.log(
      `[dry] ${slug} → ${cur.title} | 题材 ${nf.tags.join('/') || '-'} | 状态 ${nf.status} | 章节 ${nf.latestChapter || '-'} @ ${nf.latestChapterAt || '-'}`
    );
}

console.log(
  APPLY
    ? `已写回 ${updated} 条 mkzhan 条目（跳过 ${skipped} 条未匹配）`
    : `[dry-run] 将更新 ${updated} 条，跳过 ${skipped} 条未匹配`
);
