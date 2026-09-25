/**
 * Cloudflare Pages Function —— 批量下架回传端点（第三方采集侧判定 → 本站执行下架）
 * ------------------------------------------------------------------
 * 背景：抖音 / TikTok 的「是否下架」无法从海外 CI 用裸 HTTP 判定
 *   （抖音对任何视频都返 200 风控壳，HEAD 连正常视频也返 404；TikTok 海外出口受限）。
 *   可靠判定只能在采集侧（中国本地，有真实 IP + 签名请求）完成。
 *   因此采用「采集侧判定 → 每天把已下架的 sourceId / 平台视频 ID 推回本项目」的模式。
 *
 * 鉴权：Header `x-takedown-token: <TAKEDOWN_TOKEN>`（与环境变量对齐，和封面端点的
 *       `x-cover-token` 同一风格）。未配置 TAKEDOWN_TOKEN 时返回 { ok:false, fallback:true }。
 *
 * 调用：
 *   POST /api/takedown
 *   Header: x-takedown-token: <TAKEDOWN_TOKEN>
 *   Body(JSON): {
 *     "platform": "douyin",                       // 可选，仅用于日志
 *     "items": ["douyin:7663697146546694769",     // 支持 sourceId 形式
 *               "7663697146546694769",            // 或纯数字抖音视频 ID（自动拼成 douyin-<id>）
 *               "tiktok:abc123"]                   // 其它平台按 platform:id → <platform>-<id>
 *   }
 *   返回: { ok:true, processed:N, removed:["videos/douyin-..."], skipped:["..."] }
 *
 * 行为：对每个 item 解析出 slug，把 src/content/videos/<slug>.json 移到 removed/
 *       并清理封面（R2 或仓库内 git 文件），触发重新部署即下架。
 * 命名约定：与 check-links / prune 一致，使用扁平 removed/<type>-<slug>.json。
 */

// 最小 R2 桶接口（运行时原生满足，绑定名 COVER）
interface R2BucketLike {
  delete(key: string): Promise<void>;
}

interface Env {
  TAKEDOWN_TOKEN?: string;
  GITHUB_TOKEN?: string;
  GITHUB_REPO?: string;
  COVER?: R2BucketLike;
  R2_PUBLIC_URL?: string;
}

const GH_API = 'https://api.github.com';
const TYPE = 'videos';

function json(data: any, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', ...headers },
  });
}

/** 把 item（sourceId / 纯数字抖音 id / platform:id）解析为内容文件 slug（不含扩展名）。 */
function resolveSlug(item: string): string | null {
  const s = (item || '').toString().trim();
  if (!s) return null;
  // 纯数字抖音视频 ID → douyin-<id>
  if (/^\d+$/.test(s)) return `douyin-${s}`;
  const m = s.match(/^([a-z0-9]+):(.+)$/i);
  if (m) return `${m[1].toLowerCase()}-${m[2]}`; // douyin:xxx → douyin-xxx；tiktok:abc → tiktok-abc
  return null;
}

async function githubDeleteFile(
  repo: string,
  filePath: string,
  branch: string,
  ghHeaders: Record<string, string>,
): Promise<boolean> {
  const getRes = await fetch(`${GH_API}/repos/${repo}/contents/${filePath}?ref=${branch}`, {
    headers: ghHeaders,
  });
  if (!getRes.ok) return false;
  const f: any = await getRes.json().catch(() => null);
  if (!f || !f.sha) return false;
  const delRes = await fetch(`${GH_API}/repos/${repo}/contents/${filePath}`, {
    method: 'DELETE',
    headers: ghHeaders,
    body: JSON.stringify({
      message: `takedown: remove cover ${filePath}`,
      sha: f.sha,
      branch,
      committer: { name: 'HubLinks Takedown', email: 'takedown@hublinks.example' },
    }),
  });
  return delRes.ok;
}

async function cleanupCover(
  coverUrl: string | undefined,
  env: Env,
  repo: string,
  branch: string,
  ghHeaders: Record<string, string>,
): Promise<void> {
  if (!coverUrl || typeof coverUrl !== 'string') return;
  const r2Base = (env.R2_PUBLIC_URL || '').replace(/\/+$/, '');
  if (env.COVER && r2Base && coverUrl.startsWith(r2Base)) {
    const key = coverUrl.slice(r2Base.length).replace(/^\/+/, '');
    try {
      await env.COVER.delete(key);
    } catch (e) {
      console.error('cover R2 delete failed', e);
    }
    return;
  }
  if (coverUrl.startsWith('/')) {
    try {
      await githubDeleteFile(repo, `public${coverUrl}`, branch, ghHeaders);
    } catch (e) {
      console.error('cover git delete failed', e);
    }
  }
}

/** 在 src/content/videos 下按 slug 或 sourceId 定位内容文件（返回 { slug, sha }）。 */
async function locateEntry(
  repo: string,
  branch: string,
  slug: string | null,
  originalItem: string,
  ghHeaders: Record<string, string>,
): Promise<{ slug: string; sha: string } | null> {
  const listRes = await fetch(`${GH_API}/repos/${repo}/contents/src/content/${TYPE}?ref=${branch}`, {
    headers: ghHeaders,
  });
  if (!listRes.ok) return null;
  const list: any[] = await listRes.json().catch(() => []);
  if (!Array.isArray(list)) return null;

  // 1) slug 直接命中
  if (slug) {
    const hit = list.find((f) => f.name === `${slug}.json`);
    if (hit) return { slug, sha: hit.sha };
  }
  // 2) sourceId 命中（读取每个文件的 sourceId 字段比对）
  for (const f of list) {
    if (!f.name.endsWith('.json')) continue;
    const getRes = await fetch(`${GH_API}/repos/${repo}/contents/${f.path}?ref=${branch}`, {
      headers: ghHeaders,
    });
    if (!getRes.ok) continue;
    const file = await getRes.json().catch(() => null);
    if (!file || !file.content) continue;
    try {
      const data = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
      if (data.sourceId === originalItem) return { slug: f.name.replace(/\.json$/, ''), sha: file.sha };
    } catch {
      /* 跳过解析失败 */
    }
  }
  return null;
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

  if (!env.TAKEDOWN_TOKEN || !env.GITHUB_TOKEN || !env.GITHUB_REPO) {
    return json({ ok: false, fallback: true, message: 'takedown endpoint not configured' }, 200);
  }

  const token = request.headers.get('x-takedown-token');
  if (token !== env.TAKEDOWN_TOKEN) {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid json' }, 400);
  }

  const items: string[] = Array.isArray(body?.items) ? body.items : [];
  if (items.length === 0) return json({ ok: false, error: 'items required' }, 400);

  const ghHeaders = {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    'User-Agent': 'hublinks-takedown',
    Accept: 'application/vnd.github+json',
  };

  let branch = 'main';
  try {
    const repoRes = await fetch(`${GH_API}/repos/${env.GITHUB_REPO}`, { headers: ghHeaders });
    if (repoRes.ok) branch = (await repoRes.json()).default_branch || 'main';
  } catch {
    /* 用默认 main */
  }

  const removed: string[] = [];
  const skipped: string[] = [];
  let processed = 0;

  for (const item of items.slice(0, 500)) {
    processed++;
    const slug = resolveSlug(item);
    const entry = await locateEntry(env.GITHUB_REPO!, branch, slug, item, ghHeaders);
    if (!entry) {
      skipped.push(item);
      continue;
    }
    const srcPath = `src/content/${TYPE}/${entry.slug}.json`;
    const dstPath = `removed/${TYPE}-${entry.slug}.json`;

    try {
      // 读取源文件（含封面地址）
      const getRes = await fetch(`${GH_API}/repos/${env.GITHUB_REPO}/contents/${srcPath}?ref=${branch}`, {
        headers: ghHeaders,
      });
      if (!getRes.ok) {
        skipped.push(item);
        continue;
      }
      const file = await getRes.json();
      let coverUrl: string | undefined;
      try {
        coverUrl = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8')).coverUrl;
      } catch {
        /* 跳过封面清理 */
      }

      // 在 removed/ 创建副本
      const putRes = await fetch(`${GH_API}/repos/${env.GITHUB_REPO}/contents/${dstPath}`, {
        method: 'PUT',
        headers: ghHeaders,
        body: JSON.stringify({
          message: `takedown: move ${TYPE}/${entry.slug} (source: ${item})`,
          content: file.content,
          branch,
          committer: { name: 'HubLinks Takedown', email: 'takedown@hublinks.example' },
        }),
      });
      if (!putRes.ok) {
        skipped.push(item);
        continue;
      }
      // 删除源文件
      const delRes = await fetch(`${GH_API}/repos/${env.GITHUB_REPO}/contents/${srcPath}`, {
        method: 'DELETE',
        headers: ghHeaders,
        body: JSON.stringify({
          message: `takedown: remove ${TYPE}/${entry.slug}`,
          sha: file.sha,
          branch,
          committer: { name: 'HubLinks Takedown', email: 'takedown@hublinks.example' },
        }),
      });
      if (!delRes.ok) {
        skipped.push(item);
        continue;
      }
      await cleanupCover(coverUrl, env, env.GITHUB_REPO!, branch, ghHeaders);
      removed.push(`${TYPE}/${entry.slug}`);
    } catch {
      skipped.push(item);
    }
  }

  return json({ ok: true, processed, removed, skipped });
}

// OPTIONS 预检（中国侧服务跨域调用）
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-takedown-token',
    },
  });
}
