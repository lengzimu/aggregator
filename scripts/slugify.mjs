#!/usr/bin/env node
// scripts/slugify.mjs
// 条目文件名（slug）生成与校验工具 —— 解决「几千条数据怎么组织、文件名怎么写」。
//
// 用法：
//   生成建议文件名（优先级：sourceId > sourceUrl 末段 > 需手动英文 slug）
//     node scripts/slugify.mjs suggest --type videos --title "深夜街边小吃摊" --platform 抖音 --sourceUrl https://www.douyin.com/video/7351...
//     node scripts/slugify.mjs suggest --type videos --sourceId "douyin:7351284771920364811" --platform 抖音
//   手动指定英文 slug，校验是否冲突 / 含非 ASCII
//     node scripts/slugify.mjs check --type videos --slug street-food
//   扫描现有全部条目，列出中文（非 ASCII）文件名 —— SEO / URL 隐患
//     node scripts/slugify.mjs --scan
//
// slug 命名规范（详见 DATA_FORMAT.md）：
//   1. 优先用 sourceId（平台内唯一，稳定、纯 ASCII、天然去重）
//   2. 无 sourceId 时用 sourceUrl 末段视频 ID
//   3. 都没有则人工给英文 slug（音译/意译/拼音），绝不用中文文件名
// 2026-09 起条目为 JSON 数据文件，slug = 文件名（去 .json）。

import { existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const TYPES = ['videos', 'comics', 'novels'];

const PLATFORM_EN = {
  '抖音': 'douyin', 'TikTok': 'tiktok',
  'Webtoon': 'webtoon', 'Tapas': 'tapas', '腾讯动漫': 'qqac', '漫客栈': 'manhua', '快看': 'kuaikan',
  'Webnovel': 'webnovel', 'Wattpad': 'wattpad', 'Wuxiaworld': 'wuxiaworld', '番茄小说': 'fanqie',
};

function platformEn(p) {
  return PLATFORM_EN[p] || String(p).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function extractIdFromUrl(url) {
  if (!url) return null;
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

function normalizeId(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function suggest({ title, platform, sourceId, sourceUrl }) {
  if (sourceId && normalizeId(sourceId)) return { slug: normalizeId(sourceId), via: 'sourceId' };
  const id = extractIdFromUrl(sourceUrl);
  if (id) return { slug: platformEn(platform) + '-' + id, via: 'sourceUrl' };
  return { slug: null, via: 'manual-needed', hint: '无 sourceId / 可解析的 sourceUrl，请手动提供英文 slug（如 street-food）' };
}

function exists(type, slug) {
  return existsSync(join(ROOT, 'src/content', type, slug + '.json'));
}

function listSlugs(type) {
  const dir = join(ROOT, 'src/content', type);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
}

function hasNonAscii(s) {
  return /[^ -~]/.test(s);
}

// ---- CLI ----
const [cmd, ...rest] = process.argv.slice(2);
const arg = (k) => {
  const i = rest.indexOf(k);
  return i >= 0 ? rest[i + 1] : undefined;
};

if (cmd === 'suggest') {
  const type = arg('--type') || 'videos';
  const title = arg('--title');
  const platform = arg('--platform');
  const sourceId = arg('--sourceId');
  const sourceUrl = arg('--sourceUrl');
  if (!TYPES.includes(type)) {
    console.error('未知类型：' + type);
    process.exit(1);
  }
  const r = suggest({ title, platform, sourceId, sourceUrl });
  if (r.slug) {
    const clash = exists(type, r.slug);
    console.log(`建议文件名: ${r.slug}.json   (来源: ${r.via})${clash ? '  [冲突：已存在]' : ''}`);
  } else {
    console.log('需要手动提供英文 slug。' + (r.hint || ''));
  }
} else if (cmd === 'check') {
  const type = arg('--type') || 'videos';
  const slug = arg('--slug');
  if (!slug) {
    console.error('请传 --slug');
    process.exit(1);
  }
  const bad = hasNonAscii(slug);
  const clash = exists(type, slug);
  console.log(`slug: ${slug}`);
  console.log(`  非 ASCII（含中文）: ${bad ? '是 [不建议]' : '否 [ok]'}`);
  console.log(`  与现有文件冲突: ${clash ? '是 [冲突]' : '否 [ok]'}`);
} else if (cmd === '--scan' || cmd === 'scan') {
  for (const type of TYPES) {
    const slugs = listSlugs(type);
    const nonAscii = slugs.filter(hasNonAscii);
    console.log(`\n[${type}] 共 ${slugs.length} 条`);
    if (nonAscii.length) {
      console.log('  非 ASCII 文件名（应改为英文 slug）:');
      nonAscii.forEach((s) => console.log('    - ' + s));
    } else {
      console.log('  全部为 ASCII slug [ok]');
    }
  }
} else {
  console.log('用法:');
  console.log('  node scripts/slugify.mjs suggest --type <videos|comics|novels> --title "标题" --platform 抖音 [--sourceId x] [--sourceUrl u]');
  console.log('  node scripts/slugify.mjs check   --type videos --slug street-food');
  console.log('  node scripts/slugify.mjs --scan');
}
