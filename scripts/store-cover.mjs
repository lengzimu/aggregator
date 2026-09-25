// 短视频封面存储（自动降级：配了 R2 走 R2，否则落仓库 public/covers/videos）。
// 仓库只记录返回的地址（R2 绝对 URL 或站内相对路径 /covers/videos/<slug>.jpg）。
//
// 用法：
//   node scripts/store-cover.mjs <sourceUrl|localPath> <slug> [--apply]
//
// 示例：
//   node scripts/store-cover.mjs https://.../cover.jpg coffee-art --apply
//   node scripts/store-cover.mjs ./local-cover.png douyin-7351 --apply
//
// 未加 --apply 时只 dry-run 打印将执行的动作与结果地址。
import { resolve } from 'node:path';
import { isR2Configured, storeCover } from './lib/r2.mjs';

const [, , arg1, arg2, ...rest] = process.argv;
const APPLY = rest.includes('--apply');

if (!arg1 || !arg2) {
  console.error('用法: node scripts/store-cover.mjs <sourceUrl|localPath> <slug> [--apply]');
  process.exit(1);
}

if (!APPLY) {
  const target = isR2Configured()
    ? 'R2（返回公开 URL）'
    : '本地 public/covers/videos（返回站内相对路径，无 R2 凭据时自动降级）';
  console.log(`[dry-run] 将存储封面: ${arg2} <- ${arg1}`);
  console.log(`  目标: ${target}`);
  console.log('  (加 --apply 才实际写入)');
  process.exit(0);
}

try {
  const out = await storeCover(arg1, arg2, {
    prefix: 'videos',
    localDir: resolve(process.cwd(), 'public', 'covers'),
  });
  console.log(out);
} catch (e) {
  console.error('存储失败:', e.message);
  process.exit(1);
}
