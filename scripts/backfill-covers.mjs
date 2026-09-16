// 封面回填：已收录条目若缺封面（早期采集时封面逻辑还没上线），进详情页补抓。
//
// 用法：
//   node scripts/backfill-covers.mjs           # dry-run，只打印将补的条目
//   node scripts/backfill-covers.mjs --apply   # 实际写回 src/content
//
// 覆盖范围（有可靠封面来源的平台）：
//   · 腾讯动漫 qq:<id>      → 详情页 Comic/comicInfo/id/<id> 取 manhua.acimg.cn
//   · 漫客栈   mkzhan:<id>  → 详情页 /<id>/ 取 oss.mkzcdn.com
//   · 快看     无公开封面来源（封面为鉴权 XHR 注入），跳过，维持 default-cover 兜底
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { qqCover, mkzhanCover } from './lib/adapters.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const APPLY = process.argv.includes('--apply');

const dir = join(ROOT, 'src', 'content', 'comics');
const files = (await readdir(dir)).filter((f) => f.endsWith('.json'));

let patched = 0;
for (const f of files) {
  const p = join(dir, f);
  let d;
  try {
    d = JSON.parse(await readFile(p, 'utf8'));
  } catch {
    continue;
  }
  if (d.coverUrl) continue;

  const id = String(d.sourceId || '').split(':')[1];
  if (!id) continue;

  let cover;
  if (d.platform === '腾讯动漫') cover = await qqCover(id);
  else if (d.platform === '漫客栈') cover = await mkzhanCover(id);
  else continue; // 快看等无可靠来源，跳过

  if (cover) {
    console.log(`${APPLY ? '补' : '[dry] '} ${f} -> ${cover}`);
    if (APPLY) {
      d.coverUrl = cover;
      await writeFile(p, JSON.stringify(d, null, 2) + '\n', 'utf8');
    }
    patched++;
  } else {
    console.log(`仍未取到封面: ${f} (${d.platform} #${id})`);
  }
  // 轻微间隔，避免对源站过快
  await new Promise((r) => setTimeout(r, 200));
}
console.log(`\n${APPLY ? '已回填' : 'dry-run 检测到可回填'} ${patched} 条封面`);
