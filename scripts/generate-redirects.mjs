#!/usr/bin/env node
/**
 * 生成 Cloudflare Pages 的 _redirects 文件（真实 302 跳转）。
 *
 * 在 `astro build` 之后运行，扫描所有内容条目的 sourceUrl，
 * 生成 dist/_redirects，使 Cloudflare 在边缘节点直接返回 302：
 *
 *   /videos/funny-cat/  https://www.douyin.com/video/xxxx  302
 *
 * 说明：本站在纯静态模式下无法使用 Astro.redirect()，
 * 因此用 Cloudflare 的 _redirects 实现真实的 HTTP 302 跳转；
 * 跳转页 HTML（meta refresh + JS）作为非 Cloudflare 环境的兜底。
 *
 * 2026-09 起条目为 JSON 数据文件（videos / comics / novels），
 * 直接 JSON.parse 读取 sourceUrl；editorial 是 Markdown 长文，不参与跳转。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'src', 'content');
const DIST_DIR = path.join(ROOT, 'dist');

const TYPES = ['videos', 'comics', 'novels'];

function main() {
  if (!fs.existsSync(DIST_DIR)) {
    console.error('❌ dist/ 不存在，请先运行 astro build。');
    process.exit(1);
  }

  const rules = [];
  for (const type of TYPES) {
    const dir = path.join(CONTENT_DIR, type);
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      const obj = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
      const sourceUrl = obj.sourceUrl;
      if (!sourceUrl) continue;
      const slug = file.replace(/\.json$/, '');
      rules.push(`/${type}/${slug}/  ${sourceUrl}  302`);
    }
  }

  const header = [
    '# 由 scripts/generate-redirects.mjs 自动生成，请勿手动编辑',
    '# 格式：<源路径>  <目标URL>  <状态码>',
  ];
  const output = [...header, ...rules].join('\n') + '\n';
  fs.writeFileSync(path.join(DIST_DIR, '_redirects'), output, 'utf-8');
  console.log(`✅ 已生成 dist/_redirects，共 ${rules.length} 条 302 跳转规则。`);
}

main();
