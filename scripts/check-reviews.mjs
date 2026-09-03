#!/usr/bin/env node
// 编辑精选准入校验：扫描全部条目，告警「有热度指标却没写 review」等。
// 仅告警，不阻断构建（exit 0）。建议接入 CI：npm run check:reviews
// 加 --strict 时存在任何告警则 exit 1，供 CI 拦截部署。
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lintReviews } from './lib/review.mjs';

const ROOT = join(process.cwd(), 'src/content');
const TYPES = ['videos', 'comics', 'novels'];
// --strict：存在任何告警时 exit 1，供 CI 拦截部署
const STRICT = process.argv.includes('--strict');

const entries = [];
for (const type of TYPES) {
  const dir = join(ROOT, type);
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    entries.push(JSON.parse(readFileSync(join(dir, f), 'utf8')));
  }
}

const warnings = lintReviews(entries);
if (warnings.length === 0) {
  console.log(`✓ 全部 ${entries.length} 条条目均满足编辑精选准入（有热度指标者均带 review，且字数合规）。`);
  process.exit(0);
}
console.log(`发现 ${warnings.length} 条告警：`);
for (const w of warnings) console.log(w);
if (STRICT) {
  console.error('\n[--strict] 存在告警，CI 中止部署。请补写 review 或修正字数后重试。');
  process.exit(1);
}
process.exit(0);
