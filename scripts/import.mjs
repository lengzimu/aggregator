// 半自动导入 —— 用于反爬强的平台（番茄小说 / 漫客栈）或批量粘贴录入。
//
// 用法：
//   1) 编辑 data/import.json（参照 data/import.example.json）
//   2) node scripts/import.mjs
//
// 每条需含：title, platform, sourceUrl, language；
// author / coverUrl / tags / status 可选。脚本会校验平台白名单与 URL 主机，
// 通过后写入 data/pending/<collection>/ 待人工复核。
// 2026-09 起 pending 为 JSON 数据文件。
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSource, isWhitelistedHost } from './lib/sources.mjs';
import { toJson, writePending } from './lib/markdown.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DRY = process.env.DRY === '1';

const VALID_STATUS = ['ongoing', 'completed'];
const VALID_LANG = ['zh', 'en'];

async function main() {
  const file = join(ROOT, 'data', 'import.json');
  let raw;
  try {
    raw = JSON.parse(await readFile(file, 'utf8'));
  } catch (e) {
    console.error(`读取 ${file} 失败：${e.message}`);
    process.exit(1);
  }
  if (!Array.isArray(raw)) {
    console.error('import.json 必须是数组');
    process.exit(1);
  }

  const report = [];
  for (const item of raw) {
    const src = getSource(item.platform);
    if (!src) {
      report.push({ title: item.title, status: 'rejected', reason: `未知平台 ${item.platform}` });
      continue;
    }
    if (!item.sourceUrl || !isWhitelistedHost(item.platform, item.sourceUrl)) {
      report.push({ title: item.title, status: 'rejected', reason: 'URL 不在平台白名单' });
      continue;
    }
    const lang = VALID_LANG.includes(item.language) ? item.language : src.language;
    const status = VALID_STATUS.includes(item.status) ? item.status : 'ongoing';
    const slug =
      (item.sourceId ? item.sourceId.replace(':', '-') : null) ||
      `${src.key}-${Date.now()}`;
    const fm = {
      title: item.title,
      author: item.author || '',
      platform: item.platform,
      sourceUrl: item.sourceUrl,
      coverUrl: item.coverUrl || undefined,
      language: lang,
      tags: Array.isArray(item.tags) ? item.tags : [],
      status,
      pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
      sourceId: item.sourceId || undefined,
      origin: 'csv',
      metrics: item.metrics || undefined,
    };
    const md = toJson(fm);
    if (!DRY) await writePending(src.collection, slug, md);
    report.push({ title: item.title, platform: item.platform, status: 'pending', slug });
  }
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
