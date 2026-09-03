#!/usr/bin/env node
/**
 * 一次性迁移：把 videos / comics / novels 的 Markdown 条目（仅 frontmatter）
 * 转为 JSON 数据文件（与 config.ts 的 type:'data' + glob loader 对齐）。
 *
 * 设计：
 *   - 用 `yaml` 解析 frontmatter（能正确处理嵌套 metrics、带冒号/特殊字符的 review）；
 *   - Date（pubDate / metrics.capturedAt）序列化为 "YYYY-MM-DD" 字符串；
 *   - 正文 body 丢弃（详情页不索引、只做跳转，schema 无 body 字段）；
 *   - 写同名 .json 后删除 .md；已无 .md 时幂等跳过。
 *
 * 用法：node scripts/migrate-to-json.mjs
 */
import { readdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const COLLECTIONS = ['videos', 'comics', 'novels'];

function dateToISO(d) {
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  if (typeof d === 'string') {
    const dt = new Date(d);
    return Number.isNaN(dt.valueOf()) ? d : dt.toISOString().slice(0, 10);
  }
  return d;
}

function serialize(obj) {
  return JSON.stringify(
    obj,
    (_k, v) => (v instanceof Date ? dateToISO(v) : v),
    2,
  ) + '\n';
}

function extractFrontmatter(text) {
  const m = String(text).match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return null;
  try {
    return YAML.parse(m[1]);
  } catch (e) {
    throw new Error(`YAML 解析失败：${e.message}`);
  }
}

async function migrateCollection(col) {
  const dir = join(ROOT, 'src', 'content', col);
  let files;
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith('.md'));
  } catch {
    return { col, migrated: 0, errors: [] };
  }
  const errors = [];
  let migrated = 0;
  for (const file of files) {
    const mdPath = join(dir, file);
    try {
      const text = await readFile(mdPath, 'utf8');
      const fm = extractFrontmatter(text);
      if (!fm) {
        errors.push({ file, reason: 'frontmatter 块缺失' });
        continue;
      }
      const json = serialize(fm);
      const jsonPath = join(dir, file.replace(/\.md$/, '.json'));
      await writeFile(jsonPath, json, 'utf8');
      await unlink(mdPath);
      migrated++;
    } catch (e) {
      errors.push({ file, reason: e.message });
    }
  }
  return { col, migrated, errors };
}

async function main() {
  console.log('=== Markdown → JSON 迁移（videos / comics / novels）===');
  let total = 0;
  for (const col of COLLECTIONS) {
    const r = await migrateCollection(col);
    total += r.migrated;
    if (r.migrated) console.log(`  ${col}: 迁移 ${r.migrated} 个`);
    if (r.errors.length) {
      console.log(`  ${col}: ${r.errors.length} 个失败`);
      for (const e of r.errors) console.log(`    - ${e.file}: ${e.reason}`);
    }
  }
  console.log(`\n完成：共迁移 ${total} 个文件到 JSON。`);
  if (total === 0) console.log('（无 .md 待迁移，可能已迁移过）');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
