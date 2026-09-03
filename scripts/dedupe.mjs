#!/usr/bin/env node
/**
 * 条目去重检测（站内重复内容体检）
 * ------------------------------------------------------------------
 * 同一作品被重复录入（尤其是多平台各录一次）会造成站内重复内容，
 * 稀释权重、也让列表页显得水。本脚本只读不改，输出重复候选供人工判断。
 *
 *   node scripts/dedupe.mjs
 *   node scripts/dedupe.mjs --strict   # 存在确定重复时 exit 1，供 CI 拦部署
 *
 * 检测三个维度：
 *   1. sourceId 完全相同          —— 一定是重复
 *   2. sourceUrl 归一化后相同      —— 一定是重复
 *   3. 标题归一化后相同            —— 疑似重复，可能是同作品多平台（需人工决定是否都留）
 *
 * 注意：标题相同但平台不同**不一定是错误**（正版分发在多个平台是常态），
 * 所以第 3 类只报告、不判定，由人决定是否合并或保留。
 * 2026-09 起内容为 JSON 数据文件，直接 JSON.parse。
 */
// JSON 数据文件直接 JSON.parse，无需 markdown 解析器
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// 脚本位于 scripts/，距仓库根 1 层
const ROOT = join(__dirname, '..');

const COLLECTIONS = ['videos', 'comics', 'novels'];

// --strict：存在确定重复时 exit 1，供 CI 拦截部署
const STRICT = process.argv.includes('--strict');

/** 归一化：小写 + 去掉空白/标点/符号（保留字母数字与 CJK），用于标题比对 */
function normTitle(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, '');
}

/** 归一化 URL：去协议、去 www、去末尾斜杠、忽略查询串差异（保留 pathname） */
function normUrl(s) {
  try {
    const u = new URL(String(s));
    const host = u.host.replace(/^www\./, '');
    return (host + u.pathname).replace(/\/+$/, '').toLowerCase();
  } catch {
    return String(s ?? '').trim().toLowerCase();
  }
}

async function loadAll() {
  const out = [];
  for (const col of COLLECTIONS) {
    const dir = join(ROOT, 'src', 'content', col);
    let files;
    try {
      files = (await readdir(dir)).filter((f) => f.endsWith('.json'));
    } catch {
      continue;
    }
    for (const file of files) {
      const text = await readFile(join(dir, file), 'utf8');
      const data = JSON.parse(text);
      out.push({
        col,
        slug: file.replace(/\.json$/, ''),
        title: data.title ?? '',
        platform: data.platform ?? '',
        sourceId: data.sourceId ?? '',
        sourceUrl: data.sourceUrl ?? '',
      });
    }
  }
  return out;
}

/** 按 key 分组，只保留出现 1 次以上的组 */
function groupBy(items, keyFn) {
  const map = new Map();
  for (const it of items) {
    const key = keyFn(it);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(it);
  }
  return [...map.entries()].filter(([, list]) => list.length > 1);
}

function show(group, label, verdict) {
  console.log(`\n===== ${label} =====`);
  if (!group.length) {
    console.log('无。');
    return 0;
  }
  for (const [key, list] of group) {
    const crossPlatform = new Set(list.map((x) => x.platform)).size > 1;
    console.log(`\n  key: ${key}${crossPlatform ? '  （跨平台）' : ''}`);
    for (const it of list) {
      console.log(`    - ${it.col}/${it.slug}  [${it.platform}]  ${it.title}`);
    }
  }
  console.log(`\n  共 ${group.length} 组重复候选 —— ${verdict}`);
  return group.length;
}

async function main() {
  const items = await loadAll();
  console.log(`已扫描 ${items.length} 个条目（${COLLECTIONS.join(' / ')}）`);

  const byId = groupBy(items, (x) => x.sourceId.trim().toLowerCase());
  const byUrl = groupBy(items, (x) => normUrl(x.sourceUrl));
  const byTitle = groupBy(items, (x) => normTitle(x.title));

  let hard = 0;
  hard += show(byId, 'sourceId 重复（确定是重复录入）', '需要处理');
  hard += show(byUrl, 'sourceUrl 重复（确定是重复录入）', '需要处理');
  const soft = show(
    byTitle,
    '标题重复（疑似同作品 / 同作品多平台）',
    '仅提示：正版多平台分发属正常，请人工决定是否都保留',
  );

  console.log('\n==== 汇总 ====');
  console.log(`确定重复   : ${hard} 组（建议合并或删除）`);
  console.log(`疑似重复   : ${soft} 组（需人工判断）`);
  console.log(`扫描条目数 : ${items.length}`);
  if (STRICT && hard > 0) {
    console.error(`\n[--strict] 存在 ${hard} 组确定重复，CI 中止部署。请先合并/删除重复条目。`);
    process.exit(1);
  }
  console.log('\n本脚本只读，不修改任何文件。');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
