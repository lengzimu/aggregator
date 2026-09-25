#!/usr/bin/env node
/**
 * 每日失效链接检查脚本（平台感知三态分类版）
 *
 * 分类结果（源链接 sourceUrl）：
 *  - dead        404 / 410（或 TikTok oembed 404）→ 视为已下架，
 *                JSON 移入 removed/，并同步清理封面文件。
 *  - alive       200 / 3xx 正常。
 *  - unverified  平台风控导致状态码不可信（如抖音对任何视频都返回 200 风控壳），
 *                或网络层失败（本地出口封锁 TikTok / 超时）→ 不删，仅列入
 *                汇总报告供人工复核。
 *
 * 平台特判（2026-09-25 实测）：
 *  - 抖音 www.douyin.com / m.douyin.com / iesdouyin.com 状态码完全不可信：
 *    GET 对「已下架」与「正常」视频都返回相同的 200 JS 风控壳（jsvmp），
 *    HEAD 则连「正常」视频也返回 404。两个方向都会误判 →
 *    一律 unverified 人工复核，不发起请求也不判下架。
 *  - TikTok 站内页面对删除视频也可能 200，改用公开 oembed 接口：
 *    https://www.tiktok.com/oembed?url=<sourceUrl>
 *    200=存活；404/410=已删除；403=私密/地区限制（unverified）；
 *    连接失败（本地沙箱整个 tiktok.com 不通，CI 海外 IP 正常）→ unverified。
 *  - 其他平台沿用状态码语义：404/410 下架，403/5xx/超时 = unverified（防反爬误删）。
 *
 * 封面图（coverUrl）失效（404 / 403 / 超时）→ 整字段删除 coverUrl
 * （不能置空串，否则 z.string().url() schema 校验失败），页面回退 default-cover.svg。
 *
 * 2026-09 起内容为 JSON 数据文件（videos / comics / novels）。
 *
 * 用法：node scripts/check-links.js
 *       CHECK_TYPES=videos node scripts/check-links.js   # 只查指定类型
 * 说明：脚本仅依赖 Node 内置模块，无需安装依赖。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import https from 'node:https';
import { removeCover } from './lib/r2.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'src', 'content');
const REMOVED_DIR = path.join(ROOT, 'removed');

const TYPES = (process.env.CHECK_TYPES || 'videos,comics,novels')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const DELAY_MS = 300; // 请求间隔，避免过于激进
const TIMEOUT_MS = 10000;
const MAX_REDIRECTS = 3;
const USER_AGENT =
  'Mozilla/5.0 (compatible; HubLinks-LinkChecker/1.0; +https://example.com)';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 从 URL host 识别平台（小写），无法识别返回 '' */
function detectPlatform(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.endsWith('douyin.com') || host.endsWith('iesdouyin.com')) return 'douyin';
    if (host.endsWith('tiktok.com')) return 'tiktok';
    return '';
  } catch {
    return '';
  }
}

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
 * 源链接三态分类：'dead' | 'alive' | 'unverified'
 * dead 才会触发下架；alive / unverified 一律保留。
 */
async function classifySource(sourceUrl) {
  const platform = detectPlatform(sourceUrl);

  // 抖音：状态码完全不可信，直接跳过请求（2026-09-25 实测）：
  //  - GET 任何视频（含已下架）都返回 200 的 jsvmp 风控壳（www / m / iesdouyin 同构）；
  //  - HEAD 请求则连「正常视频」也返回 404（反爬拦 HEAD）。
  //  → 两个方向都会误判，唯一安全解：全部 unverified，人工复核。
  if (platform === 'douyin') {
    return { verdict: 'unverified', detail: '抖音风控（状态码不可信，需人工打开复核）' };
  }

  // TikTok：站内页面对删除视频也常返 200，改用公开 oembed 接口判断
  if (platform === 'tiktok') {
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(sourceUrl)}`;
    const res = await request(oembedUrl, 'GET');
    if (res.status === 200) return { verdict: 'alive', detail: `oembed ${res.status}` };
    if (res.status === 404 || res.status === 410)
      return { verdict: 'dead', detail: `oembed ${res.status}` };
    // 403=私密/地区限制；0=网络层失败（本地沙箱 tiktok 整域不通 / 超时）
    return { verdict: 'unverified', detail: `oembed ${res.status || 'ERR'}` };
  }

  const res = await request(sourceUrl);
  if (res.status === 404 || res.status === 410)
    return { verdict: 'dead', detail: `${res.status}` };
  if (res.status >= 200 && res.status < 400) {
    if (platform === 'douyin') {
      // 抖音对已下架视频同样返回 200 风控壳（jsvmp），状态码不可信
      return { verdict: 'unverified', detail: `${res.status}（风控壳，无法区分下架）` };
    }
    return { verdict: 'alive', detail: `${res.status}` };
  }
  // 403 反爬 / 5xx / 超时 / 网络错误 → 不判死
  return { verdict: 'unverified', detail: `${res.status || 'ERR'}` };
}

/**
 * 处理单个 JSON 数据文件，返回 'ok' | 'updated' | 'removed' | 'skipped' | 'unverified'
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

  // 1) 源链接三态分类：只有 dead（真实 404/410）才下架
  const src = await classifySource(sourceUrl);
  await sleep(DELAY_MS);

  if (src.verdict === 'dead') {
    // 下架前先清理封面文件（本地仓库内 / R2），避免孤儿封面
    let coverNote = '';
    if (coverUrl) {
      try {
        const removed = await removeCover(coverUrl, { root: ROOT });
        if (removed) coverNote = '（封面已同步清理）';
      } catch (e) {
        coverNote = `（封面清理失败：${e.message}）`;
      }
    }
    console.log(`  🗑️  源链接已下架 (${src.detail}): ${sourceUrl} → 移入 removed/${coverNote}`);
    const removedPath = path.join(REMOVED_DIR, `${type}-${basename}`);
    fs.renameSync(filePath, removedPath);
    return 'removed';
  }

  if (src.verdict === 'unverified') {
    console.log(`  ❓ [${type}] ${basename} → source ${src.detail}（保留，待人工复核）`);
    return 'unverified';
  }

  console.log(`  ✅ [${type}] ${basename} → source ${src.detail}`);

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

  const stats = { ok: 0, updated: 0, removed: 0, skipped: 0, unverified: 0 };
  const unverifiedFiles = [];

  for (const type of TYPES) {
    const dir = path.join(CONTENT_DIR, type);
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
    console.log(`📂 ${type}: ${files.length} 个文件`);
    for (const file of files) {
      const result = await processFile(path.join(dir, file), type);
      if (result in stats) stats[result]++;
      if (result === 'unverified') unverifiedFiles.push(`${type}/${file}`);
    }
    console.log('');
  }

  console.log('📊 检查完成：');
  console.log(`  ✅ 正常: ${stats.ok}`);
  console.log(`  🖼️  已清理失效封面: ${stats.updated}`);
  console.log(`  🗑️  已移除下架内容: ${stats.removed}`);
  console.log(`  ⏭️  跳过: ${stats.skipped}`);
  console.log(`  ❓ 无法自动核验（保留）: ${stats.unverified}`);
  if (unverifiedFiles.length > 0) {
    console.log('\n📋 以下条目状态码不可信（平台风控 / 出口封锁 / 超时），请人工打开链接复核：');
    for (const f of unverifiedFiles) console.log(`  - ${f}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
