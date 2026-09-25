// 短视频封面上传到 R2（仓库只记录返回的公开 URL）。
//
// 用法：
//   node scripts/store-cover.mjs <sourceUrl|localPath> <slug> [--apply]
//
// 示例：
//   node scripts/store-cover.mjs https://.../cover.jpg coffee-art --apply
//   node scripts/store-cover.mjs ./local-cover.png douyin-7351 --apply
//
// 未配置 R2 环境变量或缺少 --apply 时只 dry-run 打印将执行的动作。
import { existsSync } from 'node:fs';
import { isR2Configured, storeCoverFromUrl, storeCoverFromFile, r2PublicUrl } from './lib/r2.mjs';

const [, , arg1, arg2, ...rest] = process.argv;
const APPLY = rest.includes('--apply');

if (!arg1 || !arg2) {
  console.error('用法: node scripts/store-cover.mjs <sourceUrl|localPath> <slug> [--apply]');
  process.exit(1);
}

const previewUrl = r2PublicUrl(`videos/${arg2}.jpg`);

if (!isR2Configured()) {
  console.error('⚠️ 未配置 R2 环境变量（R2_ACCOUNT_ID / R2_BUCKET / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_PUBLIC_URL）');
  console.error(`（dry-run）将得到公开地址: ${previewUrl}`);
  if (!APPLY) {
    console.log('[dry] 未上传（加 --apply 且配好凭据才实际上传）');
    process.exit(0);
  }
  console.error('缺少凭据，无法上传');
  process.exit(1);
}

try {
  const url = existsSync(arg1)
    ? await storeCoverFromFile(arg1, arg2)
    : await storeCoverFromUrl(arg1, arg2);
  console.log(url);
} catch (e) {
  console.error('上传失败:', e.message);
  process.exit(1);
}
