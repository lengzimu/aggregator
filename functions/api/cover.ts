/**
 * Cloudflare Pages Function —— 短视频封面直传端点
 * ------------------------------------------------------------------
 * 第三方推送短视频时，封面不能只给外链（抖音/TikTok 防盗链），必须存储。
 * 本端点让第三方无需 R2 密钥也能把封面传上来：POST 源图 URL（或图片字节），
 * 函数用 R2 绑定 COVER 存好后返回公开 URL，第三方把该 URL 填进 coverUrl 即可。
 *
 * 需要的环境变量 / 绑定（Cloudflare Pages → Settings 配置）：
 *   COVER               R2 桶绑定（变量名 COVER，绑定到封面桶）
 *   COVER_UPLOAD_TOKEN  上传口令（任意长随机串，第三方持此调用）
 *   R2_PUBLIC_URL       桶公开地址，如 https://<bucket>.r2.dev 或自定义域
 *
 * 调用：
 *   POST /api/cover
 *   Header: x-cover-token: <COVER_UPLOAD_TOKEN>
 *   Body(JSON): { "url": "<源封面地址>", "slug": "<可选，缺省自动生成>" }
 *   返回: { "ok": true, "url": "https://<host>/videos/<slug>.<ext>", "key": "videos/<slug>.<ext>" }
 */

// 最小 R2 桶接口（避免引入 @cloudflare/workers-types，运行时原生满足）
interface R2BucketLike {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | string | ReadableStream,
    opts?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
}

interface Env {
  COVER?: R2BucketLike;
  COVER_UPLOAD_TOKEN?: string;
  R2_PUBLIC_URL?: string;
}

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

function json(data: any, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', ...headers },
  });
}

function extFromCt(ct: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/avif': 'avif',
  };
  return map[ct] || '';
}

function extFromUrl(u: URL): string {
  const m = u.pathname.match(/\.([a-z0-9]+)(?:[?#]|$)/i);
  return m ? m[1].toLowerCase() : '';
}

function slugFromUrl(u: URL): string {
  let h = 0;
  const s = u.host + u.pathname;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return 'c' + (h >>> 0).toString(36);
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

  if (!env.COVER) {
    return json({ ok: false, error: 'cover storage not configured' }, 503);
  }

  const token =
    request.headers.get('x-cover-token') || new URL(request.url).searchParams.get('token');
  if (!env.COVER_UPLOAD_TOKEN || token !== env.COVER_UPLOAD_TOKEN) {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid json' }, 400);
  }

  const src = (body.url || '').toString().trim();
  if (!src) return json({ ok: false, error: 'url required' }, 400);

  let u: URL;
  try {
    u = new URL(src);
  } catch {
    return json({ ok: false, error: 'invalid url' }, 400);
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return json({ ok: false, error: 'invalid protocol' }, 400);
  }

  const slug = (body.slug || '').toString().trim() || slugFromUrl(u);

  let res: Response;
  try {
    res = await fetch(src, { redirect: 'follow' });
  } catch (e: any) {
    return json({ ok: false, error: 'fetch failed: ' + e.message }, 502);
  }
  if (!res.ok) return json({ ok: false, error: 'source HTTP ' + res.status }, 502);

  const ct = res.headers.get('content-type') || '';
  if (!ct.startsWith('image/')) return json({ ok: false, error: 'not an image (' + ct + ')' }, 415);

  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) return json({ ok: false, error: 'too large' }, 413);

  const ext = extFromCt(ct) || extFromUrl(u) || 'jpg';
  const key = `videos/${slug}.${ext}`;

  try {
    await env.COVER.put(key, buf, { httpMetadata: { contentType: ct } });
  } catch (e: any) {
    return json({ ok: false, error: 'store failed: ' + e.message }, 500);
  }

  const publicUrl = `${(env.R2_PUBLIC_URL || '').replace(/\/+$/, '')}/${key}`;
  return json({ ok: true, url: publicUrl, key }, 200);
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-cover-token',
    },
  });
}
