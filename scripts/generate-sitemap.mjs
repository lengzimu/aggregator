/**
 * 零依赖 sitemap 生成器（替代 @astrojs/sitemap，规避 Astro 4/5 集成不兼容）。
 *
 * 逻辑：扫描 astro build 产物 dist/ 下的 index.html，转成站点 URL，
 * 排除「详情跳转页 / 搜索页 / 404 / pagefind 资源」，再写出：
 *   - dist/sitemap-0.xml        （urlset）
 *   - dist/sitemap-index.xml    （索引，指向 sitemap-0.xml）
 *
 * 站点域名取 PUBLIC_SITE_URL（与 astro.config.mjs 一致），缺省回退 example.com。
 */
import { readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const distDir = join(root, 'dist');

const site = (process.env.PUBLIC_SITE_URL || 'https://example.com').replace(/\/+$/, '');

// 需要排除的路段（详情跳转页、搜索页、404、pagefind 内部资源）
const EXCLUDE_RE = [
  // 详情跳转页（/videos/<slug>/ 与 /en/videos/<slug>/）—— noindex + robots Disallow，
  // 之前的正则漏了 /en/ 前缀，导致英文跳转页被误收录进 sitemap。
  /^\/(en\/)?(videos|comics|novels)\/[^/]+\/?$/,
  /^\/(en\/)?search\/?$/, // 前端搜索页（中/英）
  /^\/404\/?$/, // 404
  /^\/pagefind\//, // 搜索索引资源
  /\/pagefind\//,
];

/** 递归收集所有 index.html 的相对路径（不含扩展名时的目录形式） */
function walk(dir, base = '') {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === 'pagefind') continue; // 跳过搜索资源目录
    const full = join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full, rel));
    else if (name === 'index.html') out.push(rel.replace(/index\.html$/, ''));
  }
  return out;
}

function toUrl(relPath) {
  // relPath 形如 '' (根) / 'comics/' / 'en/videos/'
  const p = '/' + relPath; // 保证以 / 开头
  return site + p;
}

const rels = walk(distDir);
const urls = [];
for (const rel of rels) {
  const path = '/' + rel; // 例如 /videos/ 或 /videos/coffee-art/
  if (EXCLUDE_RE.some((re) => re.test(path))) continue;
  urls.push(path);
}

urls.sort();

const now = new Date().toISOString();

const urlset = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url><loc>${site + u}</loc><lastmod>${now}</lastmod></url>`
  )
  .join('\n')}
</urlset>
`;

const index = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${site}/sitemap-0.xml</loc><lastmod>${now}</lastmod></sitemap>
</sitemapindex>
`;

writeFileSync(join(distDir, 'sitemap-0.xml'), urlset);
writeFileSync(join(distDir, 'sitemap-index.xml'), index);

console.log(`✅ 已生成 sitemap：${urls.length} 个 URL → dist/sitemap-0.xml + dist/sitemap-index.xml`);
console.log('   收录示例：');
for (const u of urls.slice(0, 8)) console.log('   ' + site + u);
if (urls.length > 8) console.log(`   … 共 ${urls.length} 条`);
