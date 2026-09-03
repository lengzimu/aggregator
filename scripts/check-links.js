#!/usr/bin/env node
/**
 * 每日失效链接检查脚本
 *
 * 功能：
 *  1. 封面图（coverUrl）失效（404 / 403 / 超时）→ 从 JSON 中移除 coverUrl 字段，
 *     页面回退到 default-cover.svg。（注意：必须整字段删除，不能置空串，否则 schema 校验失败）
 *  2. 源链接（sourceUrl）返回 404 / 410 → 将 JSON 移入项目根目录 removed/，
 *     使其不再参与构建（removed/ 位于 src/content 之外，避免被 Astro 当作集合解析）。
 *  3. 全程只读 + 少量写操作，逐条请求并限速，避免误删。
 *
 * 2026-09 起内容为 JSON 数据文件（videos / comics / novels）。
 *
 * 用法：node scripts/check-links.js
 * 说明：脚本仅依赖 Node 内置模块，无需安装依赖。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import https from 'node:https';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'src', 'content');
const REMOVED_DIR = path.join(ROOT, 'removed');

const TYPES = ['videos', 'comics', 'novels'];
const DELAY_MS = 300; // 请求间隔，避免过于激进
const TIMEOUT_MS = 10000;
const MAX_REDIRECTS = 3;
const USER_AGENT =
  'Mozilla/5.0 (compatible; HubLinks-LinkChecker/1.0; +https://example.com)';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 发起请求（HEAD 优先，405/501 时回退 GET），支持跟随重定向。
 * 返回 { status, finalUrl }
 */
function request(url, method = 'HEAD', redirectsLeft = MAX_REDIRECTS) {
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return resolve({ status: 0, finalUrl: url });
    }

    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.request(
      parsed,
      {
        method,
        timeout: TIMEOUT_MS,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: '*/*',
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        // 重定向
        if (
          [301, 302, 303, 307, 308].includes(status) &&
          res.headers.location &&
          redirectsLeft > 0
        ) {
          res.resume();
          const next = new URL(res.headers.location, parsed).toString();
          resolve(request(next, method, redirectsLeft - 1));
          return;
        }
        // HEAD 不被支持时，改用 GET 再试一次
        if (status === 405 || status === 501) {
          res.resume();
          resolve(request(url, 'GET', redirectsLeft));
          return;
        }
        res.resume();
        resolve({ status, finalUrl: url });
      },
    );

    req.on('error', () => resolve({ status: 0, finalUrl: url }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 0, finalUrl: url });
    });
    req.end();
  });
}

/**
 * 处理单个 JSON 数据文件，返回 'ok' | 'updated' | 'removed' | 'skipped'
 */
async function processFile(filePath, type) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    console.log(`  ⚠️  JSON 解析失败，跳过: ${path.basename(filePath)}`);
    return 'skipped';
  }
  const basename = path.basename(filePath);
  const sourceUrl = data.sourceUrl;
  const coverUrl = data.coverUrl;

  if (!sourceUrl) {
    console.log(`  ⚠️  缺少 sourceUrl，跳过: ${basename}`);
    return 'skipped';
  }

  // 1) 检查源链接：仅 404 / 410 视为下架（避免因反爬 403 误删）
  const src = await request(sourceUrl);
  await sleep(DELAY_MS);
  if (src.status === 404 || src.status === 410) {
    console.log(`  🗑️  源链接已下架 (${src.status}): ${sourceUrl} → 移入 removed/`);
    const removedPath = path.join(REMOVED_DIR, `${type}-${basename}`);
    fs.renameSync(filePath, removedPath);
    return 'removed';
  }
  console.log(`  ✅ [${type}] ${basename} → source ${src.status || 'ERR'}`);

  // 2) 检查封面图：失效则移除 coverUrl 字段（整字段删除，不置空串）
  if (coverUrl && coverUrl.startsWith('http')) {
    const cov = await request(coverUrl);
    await sleep(DELAY_MS);
    const covOk = cov.status >= 200 && cov.status < 400;
    if (!covOk) {
      console.log(`  🖼️  封面失效 (${cov.status || '超时'}): ${coverUrl} → 移除 coverUrl`);
      delete data.coverUrl;
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
      return 'updated';
    }
  }

  return 'ok';
}

async function main() {
  console.log('🔍 开始检查失效链接…\n');

  if (!fs.existsSync(REMOVED_DIR)) {
    fs.mkdirSync(REMOVED_DIR, { recursive: true });
  }

  const stats = { ok: 0, updated: 0, removed: 0, skipped: 0 };

  for (const type of TYPES) {
    const dir = path.join(CONTENT_DIR, type);
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
    console.log(`📂 ${type}: ${files.length} 个文件`);
    for (const file of files) {
      const result = await processFile(path.join(dir, file), type);
      if (result in stats) stats[result]++;
    }
    console.log('');
  }

  console.log('📊 检查完成：');
  console.log(`  ✅ 正常: ${stats.ok}`);
  console.log(`  🖼️  已清理失效封面: ${stats.updated}`);
  console.log(`  🗑️  已移除下架内容: ${stats.removed}`);
  console.log(`  ⏭️  跳过: ${stats.skipped}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
