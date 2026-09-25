#!/usr/bin/env node
/**
 * 应用「中国侧回流的已下架视频 ID」JSON，命中即下架 + 清封面。
 *
 * 设计（贴合本项目「GitHub 即 CMS」模式，零 Cloudflare Function、零密钥调用）：
 *   中国本地每天把当天 isTakenDown 的抖音/TikTok 视频 ID 写成 JSON 推到本仓库
 *   （提交到 data/takedowns/ 目录，文件名随意，如 queue.json 或 2026-09-25.json），
 *   本脚本读取这些文件 → 命中 src/content/videos/<slug>.json 的移到 removed/ → 清封面。
 *
 * 输入文件格式（data/takedowns/*.json，archive/ 子目录除外）：
 *   {
 *     "platform": "douyin",                         // 可选，仅日志
 *     "takenDown": [
 *       "7663697146546694769",                      // 纯数字抖音视频 ID → douyin-<id>
 *       "douyin:7663697146546694769",               // sourceId 形式（推荐）
 *       "tiktok:abc123"                             // 其它平台 platform:id → <platform>-<id>
 *     ]
 *   }
 *
 * 行为：
 *   - 命中且文件存在 → 移入 removed/videos-<slug>.json（扁平命名，与 prune/check-links 一致），
 *     并 removeCover 清封面（本地 public/covers 或 R2，复用 lib/r2.mjs）。
 *   - 处理完的文件移到 data/takedowns/archive/ 留痕，避免重复处理。
 *   - 已不存在的 slug → skipped（已下架过，安全跳过）。
 *
 * 用法：node scripts/apply-takedown.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { removeCover } from './lib/r2.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'src', 'content', 'videos');
const REMOVED_DIR = path.join(ROOT, 'removed');
const TAKEDOWN_DIR = path.join(ROOT, 'data', 'takedowns');
const ARCHIVE_DIR = path.join(TAKEDOWN_DIR, 'archive');

/** 把 item（sourceId / 纯数字抖音 id / platform:id）解析为内容 slug（不含扩展名）。 */
function resolveSlug(item) {
  const s = (item || '').toString().trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return `douyin-${s}`; // 纯数字抖音 ID
  const m = s.match(/^([a-z0-9]+):(.+)$/i);
  if (m) return `${m[1].toLowerCase()}-${m[2]}`; // douyin:xxx / tiktok:abc
  return null;
}

async function moveToRemoved(slug) {
  const src = path.join(CONTENT_DIR, `${slug}.json`);
  if (!fs.existsSync(src)) return false;
  const raw = fs.readFileSync(src, 'utf-8');
  let cover;
  try {
    cover = JSON.parse(raw).coverUrl;
  } catch {
    /* ignore */
  }
  // 清封面（best-effort，不阻断下架）
  if (cover) {
    try {
      await removeCover(cover, { root: ROOT });
    } catch (e) {
      console.log(`  ⚠️  封面清理失败（已下架条目）: ${cover} → ${e.message}`);
    }
  }
  const dst = path.join(REMOVED_DIR, `videos-${slug}.json`);
  fs.mkdirSync(REMOVED_DIR, { recursive: true });
  fs.renameSync(src, dst);
  return true;
}

async function main() {
  if (!fs.existsSync(TAKEDOWN_DIR)) {
    console.log('📭 无 data/takedowns/ 目录，跳过（中国侧未推送下架清单）。');
    return;
  }
  const files = fs
    .readdirSync(TAKEDOWN_DIR)
    .filter((f) => f.endsWith('.json') && f !== 'archive')
    .map((f) => path.join(TAKEDOWN_DIR, f));

  if (files.length === 0) {
    console.log('📭 data/takedowns/ 下无待处理 JSON，跳过。');
    return;
  }

  let processed = 0;
  const removed = [];
  const skipped = [];

  for (const file of files) {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch {
      console.log(`  ⚠️  解析失败，跳过: ${path.basename(file)}`);
      skipped.push(path.basename(file));
      continue;
    }
    const items = Array.isArray(data?.takenDown) ? data.takenDown : [];
    for (const item of items) {
      processed++;
      const slug = resolveSlug(item);
      if (!slug) {
        console.log(`  ⚠️  无法解析的 ID，跳过: ${item}`);
        skipped.push(item);
        continue;
      }
      const ok = await moveToRemoved(slug);
      if (ok) {
        console.log(`  🗑️  已下架: ${slug}（来源 ${item}）`);
        removed.push(slug);
      } else {
        skipped.push(item);
      }
    }
    // 处理完移入 archive 留痕
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
    const archivePath = path.join(ARCHIVE_DIR, path.basename(file));
    fs.renameSync(file, archivePath);
  }

  console.log('\n📊 应用完成：');
  console.log(`  🔢 处理 ID 数: ${processed}`);
  console.log(`  🗑️  已下架: ${removed.length}`);
  console.log(`  ⏭️  跳过/未命中: ${skipped.length}`);
  if (removed.length) console.log('  📝 下架 slug:', removed.join(', '));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
