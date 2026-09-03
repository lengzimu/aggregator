/**
 * Cloudflare Pages Function —— DMCA 直接下架端点
 * ------------------------------------------------------------------
 * 接收前端表单 POST，把指定内容从 src/content/<type>/<slug>.md
 * 移动到仓库根的 removed/<type>/<slug>.md，触发重新部署即生效下架。
 *
 * 需要的环境变量（在 Cloudflare Pages → Settings → Environment variables 配置）：
 *   GITHUB_TOKEN          具备 repo 内容写权限的 token（contents: write）
 *   GITHUB_REPO           仓库坐标，形如 owner/repo
 *   TURNSTILE_SECRET_KEY  Cloudflare Turnstile 密钥（可选，配置才校验）
 *   RATE_LIMIT_KV         KV 命名空间绑定（可选，绑定才限流）
 *   RATE_LIMIT_MAX        单窗口最大请求数（默认 5）
 *   RATE_LIMIT_WINDOW_SEC 窗口秒数（默认 3600）
 * 未配置后端时返回 { ok:false, fallback:true }，前端会自动改用预填 GitHub 工单。
 */

// 最小 KV 接口（避免引入 @cloudflare/workers-types 依赖，Cloudflare 运行时原生满足）
interface KV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

interface Env {
  GITHUB_TOKEN?: string;
  GITHUB_REPO?: string;
  TURNSTILE_SECRET_KEY?: string;
  RATE_LIMIT_KV?: KV;
  RATE_LIMIT_MAX?: string;
  RATE_LIMIT_WINDOW_SEC?: string;
}

const TYPES = new Set(['videos', 'comics', 'novels']);

function json(data: any, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', ...headers },
  });
}

function parsePageUrl(raw: string): { type: string; slug: string } | null {
  const url = raw.trim();
  // 兼容完整 URL 与站内路径：/videos/example/ 或 https://site.com/videos/example/
  const m = url.match(/\/(videos|comics|novels)\/([a-z0-9-]+)\/?$/i);
  if (!m) return null;
  const type = m[1].toLowerCase();
  const slug = m[2].toLowerCase();
  if (!TYPES.has(type)) return null;
  return { type, slug };
}

// 服务端字段级校验（前端已校验，此处作为权威兜底，防止直接 POST）
function validateBody(b: any): Record<string, string> | null {
  const errors: Record<string, string> = {};
  const name = (b.name || '').toString().trim();
  const email = (b.email || '').toString().trim();
  const original = (b.original || '').toString().trim();
  const pageUrl = (b.pageUrl || '').toString().trim();
  const signature = (b.signature || '').toString().trim();
  const faith = b.faith === true || b.faith === 'on' || b.faith === 'true';

  if (name.length < 2) errors.name = 'name too short';
  if (!email) errors.email = 'email required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'invalid email';
  if (!original) errors.original = 'original work url required';
  else {
    try {
      const u = new URL(original);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') errors.original = 'invalid url';
    } catch {
      errors.original = 'invalid url';
    }
  }
  if (!pageUrl) errors.pageUrl = 'page url required';
  else if (!/\/(videos|comics|novels)\/[a-z0-9-]+\/?$/i.test(pageUrl)) errors.pageUrl = 'invalid page url';
  if (!signature) errors.signature = 'signature required';
  if (!faith) errors.faith = 'faith statement required';

  return Object.keys(errors).length ? errors : null;
}

// ────────────────────────────────────────────────────────────
// IP 频率限制（基于 Cloudflare KV 的固定窗口计数器）
// 未绑定 RATE_LIMIT_KV 时返回 null，调用方跳过限流（优雅降级）
// ────────────────────────────────────────────────────────────

export function getClientIp(request: Request): string {
  const cf = (request as any).cf;
  if (cf && typeof cf.clientIp === 'string' && cf.clientIp) return cf.clientIp;
  const connect = request.headers.get('cf-connecting-ip');
  if (connect) return connect;
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return 'unknown';
}

export function parseRateLimitConfig(env: Env): { max: number; windowSec: number } {
  const rawMax = parseInt(env.RATE_LIMIT_MAX || '', 10);
  const max = Number.isNaN(rawMax) ? 5 : Math.max(1, rawMax);
  const rawWin = parseInt(env.RATE_LIMIT_WINDOW_SEC || '', 10);
  const windowSec = Number.isNaN(rawWin) ? 3600 : Math.max(60, rawWin);
  return { max, windowSec };
}

export async function checkRateLimit(
  request: Request,
  env: Env,
  now: number = Date.now(),
): Promise<{
  limited: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSec: number;
  headers: Record<string, string>;
} | null> {
  const kv = env.RATE_LIMIT_KV;
  if (!kv) return null; // 未绑定 KV → 跳过限流

  const { max, windowSec } = parseRateLimitConfig(env);
  const ip = getClientIp(request);
  const key = `rl:dmca:${ip}`;
  const windowMs = windowSec * 1000;

  let count = 0;
  let resetAt = now + windowMs;

  try {
    const raw = await kv.get(key);
    if (raw) {
      const rec = JSON.parse(raw) as { count: number; resetAt: number };
      if (now < rec.resetAt) {
        count = rec.count;
        resetAt = rec.resetAt;
      }
    }
  } catch {
    // KV 读取异常：放行，不阻断正常请求
    return { limited: false, limit: max, remaining: max - 1, resetAt: now + windowMs, retryAfterSec: 0, headers: {} };
  }

  count += 1;
  const limited = count > max;
  const remaining = Math.max(0, max - count);

  try {
    await kv.put(
      key,
      JSON.stringify({ count, resetAt }),
      { expirationTtl: Math.max(60, windowSec + 60) },
    );
  } catch {
    // 写入异常：放行
  }

  const resetSec = Math.ceil((resetAt - now) / 1000);
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(max),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
  };
  const retryAfterSec = limited ? Math.max(1, resetSec) : 0;
  if (limited) headers['Retry-After'] = String(retryAfterSec);

  return { limited, limit: max, remaining, resetAt, retryAfterSec, headers };
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

  // ── IP 频率限制（未绑定 RATE_LIMIT_KV 时自动跳过）──
  const rl = await checkRateLimit(request, env);
  if (rl && rl.limited) {
    return json(
      { ok: false, error: 'rate limit exceeded', retryAfter: rl.retryAfterSec },
      429,
      rl.headers,
    );
  }
  const rlHeaders = rl ? rl.headers : {};

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid json' }, 400, rlHeaders);
  }

  // 蜜罐：机器人填了隐藏字段直接忽略
  if (body.company) return json({ ok: true, ignored: true }, 200, rlHeaders);

  // 字段级校验（优先于下架逻辑返回，便于前端逐项展示）
  const fieldErrors = validateBody(body);
  if (fieldErrors) return json({ ok: false, errors: fieldErrors }, 422, rlHeaders);

  // Turnstile CAPTCHA 校验（仅当配置了密钥才生效；未配置则跳过，保持兼容）
  if (env.TURNSTILE_SECRET_KEY) {
    const token = body.cfToken;
    if (!token) return json({ ok: false, errors: { cfToken: 'captcha required' } }, 422, rlHeaders);
    try {
      const vRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token }),
      });
      const vd: any = await vRes.json().catch(() => ({ success: false }));
      if (!vd.success) return json({ ok: false, errors: { cfToken: 'captcha failed' } }, 422, rlHeaders);
    } catch {
      return json({ ok: false, errors: { cfToken: 'captcha verify error' } }, 422, rlHeaders);
    }
  }

  const target = parsePageUrl(body.pageUrl || '');
  if (!target) return json({ ok: false, error: 'cannot parse page url' }, 400, rlHeaders);

  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) {
    return json({ ok: false, fallback: true, message: 'takedown endpoint not configured' }, 200, rlHeaders);
  }

  const api = 'https://api.github.com';
  const ghHeaders = {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    'User-Agent': 'hublinks-dmca',
    Accept: 'application/vnd.github+json',
  };

  try {
    // 1) 取默认分支
    const repoRes = await fetch(`${api}/repos/${env.GITHUB_REPO}`, { headers: ghHeaders });
    if (!repoRes.ok) return json({ ok: false, error: 'repo lookup failed' }, 502, rlHeaders);
    const branch = (await repoRes.json()).default_branch || 'main';

    const srcPath = `src/content/${target.type}/${target.slug}.md`;
    const dstPath = `removed/${target.type}/${target.slug}.md`;

    // 2) 读取源文件
    const getRes = await fetch(
      `${api}/repos/${env.GITHUB_REPO}/contents/${srcPath}?ref=${branch}`,
      { headers: ghHeaders },
    );
    if (getRes.status === 404) {
      return json({ ok: false, error: 'content not found (already removed?)' }, 404, rlHeaders);
    }
    if (!getRes.ok) return json({ ok: false, error: 'read failed' }, 502, rlHeaders);
    const file = await getRes.json();

    // 3) 在 removed/ 创建副本
    const putRes = await fetch(`${api}/repos/${env.GITHUB_REPO}/contents/${dstPath}`, {
      method: 'PUT',
      headers: ghHeaders,
      body: JSON.stringify({
        message: `DMCA takedown: move ${target.type}/${target.slug} to removed/`,
        content: file.content,
        branch,
        committer: { name: 'HubLinks DMCA', email: 'dmca@hublinks.example' },
      }),
    });
    if (!putRes.ok) return json({ ok: false, error: 'create in removed failed' }, 502, rlHeaders);

    // 4) 删除源文件
    const delRes = await fetch(`${api}/repos/${env.GITHUB_REPO}/contents/${srcPath}`, {
      method: 'DELETE',
      headers: ghHeaders,
      body: JSON.stringify({
        message: `DMCA takedown: remove ${target.type}/${target.slug}`,
        sha: file.sha,
        branch,
        committer: { name: 'HubLinks DMCA', email: 'dmca@hublinks.example' },
      }),
    });
    if (!delRes.ok) return json({ ok: false, error: 'delete source failed' }, 502, rlHeaders);

    return json({ ok: true, removed: `${target.type}/${target.slug}` }, 200, rlHeaders);
  } catch (e: any) {
    return json({ ok: false, error: e?.message || 'unexpected error' }, 500, rlHeaders);
  }
}

// OPTIONS 预检（若前端跨域调用）
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
