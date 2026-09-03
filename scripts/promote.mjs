// 晋升工具：把复核通过的 data/pending/<collection>/*.json 移到 src/content/<collection>/。
//
// 三种模式：
//   node scripts/promote.mjs            # dry-run：预览所有待晋升文件（不移动）
//   node scripts/promote.mjs --apply    # 人工模式：移动全部 pending → content
//   node scripts/promote.mjs --auto     # 自动审核预览：只标出"置信可自动晋升"的条目
//   node scripts/promote.mjs --auto --apply
//                                      # 自动审核：仅移动通过置信门控的条目，
//                                        其余留在 pending 等人工复核
//
// 安全设计：默认绝不直接上线；--auto 也只在 isConfidentForAutoPromote 通过时才放行，
// 任何需人眼判断正版/封面/作者的条目都保留在 pending。
// 2026-09 起 pending / content 均为 JSON 数据文件。
// JSON 数据文件直接 JSON.parse，无需 markdown 解析器
import { readdir, rename, mkdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isConfidentForAutoPromote } from './lib/review.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
// 脚本位于 scripts/，距仓库根 1 层
const ROOT = join(__dirname, '..');
const AUTO = process.argv.includes('--auto');
const APPLY = process.argv.includes('--apply');

const COLLECTIONS = ['videos', 'comics', 'novels'];

async function main() {
  let autoCount = 0;
  let keepCount = 0;
  for (const col of COLLECTIONS) {
    const from = join(ROOT, 'data', 'pending', col);
    const to = join(ROOT, 'src', 'content', col);
    let files;
    try {
      files = (await readdir(from)).filter((f) => f.endsWith('.json'));
    } catch {
      continue; // 该集合无 pending
    }
    if (!files.length) continue;
    if (APPLY) await mkdir(to, { recursive: true });
    for (const f of files) {
      const src = join(from, f);
      const dst = join(to, f);

      // 自动审核模式：先过置信门控
      if (AUTO) {
        const text = await readFile(src, 'utf8');
        const data = JSON.parse(text);
        if (!isConfidentForAutoPromote(data)) {
          console.log(`KEEP  ${src} (未通过自动审核置信门控，留待人工)`);
          keepCount++;
          continue;
        }
        autoCount++;
      }

      if (APPLY) await rename(src, dst);
      console.log(
        `${APPLY ? 'MOVE ' : 'WOULD '}${AUTO ? 'AUTO ' : ''}${src} -> ${dst}`,
      );
    }
  }
  if (AUTO) {
    console.log(`\n（自动审核）置信可晋升 ${autoCount} 条，留人工 ${keepCount} 条。`);
  } else if (!APPLY) {
    console.log('\n（dry-run）加 --apply 执行真实移动；加 --auto 启用自动审核置信门控。');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
