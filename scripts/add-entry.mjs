#!/usr/bin/env node
// scripts/add-entry.mjs
// 内容录入脚手架 —— 「GitHub 即 CMS」零后台维护模式的核心工具。
// 一条命令生成符合 schema 的标准 JSON 条目，自动算 ASCII 文件名，
// 并可一键 git commit / push，让日常维护 = 写文件 → 推送 → Cloudflare 自动部署。
//
// 用法：
//   node scripts/add-entry.mjs --type videos --title "标题" --platform 抖音 \
//       --sourceUrl "https://..." [--sourceId "douyin:xxx"] [--creator "作者"] \
//       [--rating 8.7] [--views 1200000] [--growth 12] [--rank 3] [--subscribers 0] \
//       [--tags "a,b,c"] [--lang zh] [--review "原创短评"] [--slug custom] \
//       [--commit] [--push] [--dry-run]
//
// 漫画 / 小说用 --author 代替 --creator，可选 --status ongoing|completed。
// 不加 --commit/--push 时只落盘，方便先补 coverUrl、润色 review 再手动推送。

import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const TYPES = ['videos', 'comics', 'novels'];

// 平台白名单（与 src/content/config.ts 保持一致；config 用了 astro:content 无法在此 import）
const PLATFORMS = {
  videos: ['抖音', 'TikTok'],
  comics: ['Webtoon', 'Tapas', '腾讯动漫', '漫客栈', '快看'],
  novels: ['Webnovel', 'Wattpad', 'Wuxiaworld', '番茄小说'],
};
const PLATFORM_EN = {
  '抖音': 'douyin', 'TikTok': 'tiktok',
  'Webtoon': 'webtoon', 'Tapas': 'tapas', '腾讯动漫': 'qqac', '漫客栈': 'manhua', '快看': 'kuaikan',
  'Webnovel': 'webnovel', 'Wattpad': 'wattpad', 'Wuxiaworld': 'wuxiaworld', '番茄小说': 'fanqie',
};

// ---- 参数解析 ----
const argv = process.argv.slice(2);
const arg = (k, def) => {
  const i = argv.indexOf(k);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : def;
};
const has = (k) => argv.includes(k);
const DRY = has('--dry-run');
const COMMIT = has('--commit');
const PUSH = has('--push');

const type = arg('--type');
const title = arg('--title');
const platform = arg('--platform');
const sourceUrl = arg('--sourceUrl');
const sourceId = arg('--sourceId');
const lang = arg('--lang', 'zh');
const tagsRaw = arg('--tags', '');
const review = arg('--review', '');
const customSlug = arg('--slug');
const creator = arg('--creator');
const author = arg('--author');
const status = arg('--status', 'ongoing');
const rating = arg('--rating');
const views = arg('--views');
const growth = arg('--growth');
const rank = arg('--rank');
const subscribers = arg('--subscribers');

// ---- 基础校验 ----
const errors = [];
if (!TYPES.includes(type)) errors.push(`--type 必须是 ${TYPES.join(' / ')}`);
if (!title) errors.push('缺少 --title');
if (!sourceUrl) errors.push('缺少 --sourceUrl');
else if (!/^https?:\/\//.test(sourceUrl)) errors.push('--sourceUrl 必须是 http(s) 链接');
if (!platform) errors.push('缺少 --platform');
else if (type && !PLATFORMS[type].includes(platform))
  errors.push(`平台 ${platform} 不属于 ${type} 白名单：${PLATFORMS[type].join(' / ')}`);
if (type === 'videos' && !creator) errors.push('videos 必须提供 --creator');
if ((type === 'comics' || type === 'novels') && !author)
  errors.push(`${type} 必须提供 --author`);
if (lang !== 'zh' && lang !== 'en') errors.push('--lang 只能是 zh 或 en');

// ---- slug（文件名）生成：sourceId > sourceUrl 末段 > 手动 ----
function normalizeId(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function extractIdFromUrl(url) {
  try {
    const u = new URL(url);
    let m = u.pathname.match(/\/(?:video|note|photo|show)\/([A-Za-z0-9_]+)/);
    if (m) return m[1];
    m = u.pathname.match(/\/video\/(\d+)/);
    if (m) return m[1];
    const last = u.pathname.split('/').filter(Boolean).pop();
    if (last && /^[A-Za-z0-9_-]{6,}$/.test(last)) return last;
  } catch {}
  return null;
}
function platformEn(p) {
  return (
    PLATFORM_EN[p] ||
    String(p).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  );
}
function computeSlug() {
  if (customSlug) return customSlug;
  if (sourceId) return normalizeId(sourceId);
  const id = extractIdFromUrl(sourceUrl);
  if (id) return platformEn(platform) + '-' + id;
  return null; // 需手动
}

let slug = computeSlug();
if (!slug) errors.push('无法自动生成 ASCII slug（无 sourceId / 可解析的 sourceUrl），请用 --slug 指定英文文件名');
if (slug && /[^ -~]/.test(slug)) errors.push(`slug "${slug}" 含非 ASCII（中文），请改用英文 slug（--slug）`);
if (slug && existsSync(join(ROOT, 'src/content', type, slug + '.json')))
  errors.push(`slug "${slug}" 已存在，请换一个或先删除旧条目`);

if (errors.length) {
  console.error('✗ 录入中止，原因：');
  errors.forEach((e) => console.error('  - ' + e));
  console.error('\nslug 优先级：sourceId > sourceUrl 末段视频 ID > --slug 手动英文。绝不用中文文件名。');
  process.exit(1);
}

// ---- 构造 metrics（仅写入提供的字段）----
const metrics = {};
if (rating != null) metrics.rating = Number(rating);
if (views != null) metrics.views = Number(views);
if (growth != null) metrics.growth = Number(growth);
if (rank != null) metrics.rank = Number(rank);
if (subscribers != null) metrics.subscribers = Number(subscribers);
metrics.capturedAt = new Date().toISOString().slice(0, 10);

// ---- 构造条目 ----
const entry = {
  title,
  sourceUrl,
  platform,
  language: lang,
  tags: tagsRaw ? tagsRaw.split(',').map((s) => s.trim()).filter(Boolean) : [],
  metrics,
  review: review || '',
  origin: 'manual',
  pubDate: new Date().toISOString().slice(0, 10),
};
if (sourceId) entry.sourceId = sourceId;
if (type === 'videos') entry.creator = creator;
else {
  entry.author = author;
  entry.status = status;
}

const file = join(ROOT, 'src/content', type, slug + '.json');

if (DRY) {
  console.log('[dry-run] 将写入:', file);
  console.log(JSON.stringify(entry, null, 2));
} else {
  writeFile(file, JSON.stringify(entry, null, 2) + '\n', 'utf8');
  console.log('✓ 已生成:', file);
}

if (!review) {
  console.log(
    '\n⚠ review 为空：该条目不会进入「编辑精选」板块。请补写 40–200 字原创短评' +
      '（只写源站没有的增量信息，绝不复述剧情简介）。',
  );
}
console.log('\n下一步：');
console.log('  1. 手动补 coverUrl（可选）与 review（编辑精选必备）');
console.log('  2. npm run check:reviews   # 自检准入');
if (!COMMIT) {
  console.log(`  3. git add ${file}`);
  console.log('  4. git commit -m "content(' + type + '): add ' + title + '"');
  console.log('  5. git push                # 触发 Cloudflare 自动部署');
}

// ---- 可选 git commit / push ----
if ((COMMIT || PUSH) && !DRY) {
  try {
    execSync(`git add "${file}"`, { cwd: ROOT, stdio: 'inherit' });
    const msg = `content(${type}): add ${title}`.replace(/"/g, '\\"');
    execSync(`git commit -m "${msg}"`, { cwd: ROOT, stdio: 'inherit' });
    console.log('✓ 已提交');
    if (PUSH) {
      execSync('git push', { cwd: ROOT, stdio: 'inherit' });
      console.log('✓ 已推送到 GitHub，Cloudflare 将自动重新部署');
    } else {
      console.log('（未加 --push，未推送。运行 git push 触发部署）');
    }
  } catch (e) {
    console.error('git 操作失败：', e.message);
    process.exit(1);
  }
}
