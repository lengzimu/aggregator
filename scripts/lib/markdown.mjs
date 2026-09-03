// 内容 JSON 生成器 —— 产出与 src/content Schema 完全对齐的 .json 数据文件。
//
// 2026-09 起，videos / comics / novels 改为 `type: 'data'` 的 JSON 数据集合
// （见 src/content/config.ts）。本模块提供：
//   - toJson(obj)            对象 → JSON 文本（Date → "YYYY-MM-DD"）
//   - writeContent(col,slug) 写 src/content/<col>/<slug>.json
//   - writePending(col,slug) 写 data/pending/<col>/<slug>.json
//   - parseDataFile(path)    读 JSON 数据文件 → 对象
//   - slugify(s)             生成 URL/标题安全的 slug（保留中文，避免跨平台乱码）
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

/** 生成 URL/标题安全的 slug；保留中文，避免跨平台乱码 */
export function slugify(s) {
  const base = String(s)
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^\w一-鿿]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base.slice(0, 60) || 'item';
}

function dateToISO(d) {
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  if (typeof d === 'string') {
    const dt = new Date(d);
    return Number.isNaN(dt.valueOf()) ? d : dt.toISOString().slice(0, 10);
  }
  return d;
}

/** object → JSON 文本（Date → "YYYY-MM-DD"，其余原样） */
export function toJson(obj) {
  return (
    JSON.stringify(obj, (_k, v) => (v instanceof Date ? dateToISO(v) : v), 2) + '\n'
  );
}

export async function writeContent(collection, slug, json) {
  const dir = join(ROOT, 'src', 'content', collection);
  await mkdir(dir, { recursive: true });
  const file = join(dir, `${slug}.json`);
  await writeFile(file, json, 'utf8');
  return file;
}

export async function writePending(collection, slug, json) {
  const dir = join(ROOT, 'data', 'pending', collection);
  await mkdir(dir, { recursive: true });
  const file = join(dir, `${slug}.json`);
  await writeFile(file, json, 'utf8');
  return file;
}

/** 读取 JSON 数据文件，返回解析后的对象 */
export async function parseDataFile(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
