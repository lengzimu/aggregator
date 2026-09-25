// Cloudflare R2 上传工具（零依赖，使用 S3 兼容 API + AWS SigV4 签名）
// ------------------------------------------------------------------
// 用途：本地脚本 / CI 把短视频封面 PUT 到 R2，仓库只记录返回的公开 URL。
// 为什么不用 SDK：避免给 Node 运行时加依赖；签名用内置 node:crypto 即可。
//
// 需要的环境变量（Cloudflare 控制台 → R2 → 管理 API 令牌 创建）：
//   R2_ACCOUNT_ID         Cloudflare 账户 ID
//   R2_BUCKET             桶名
//   R2_ACCESS_KEY_ID     R2 API 令牌 ID
//   R2_SECRET_ACCESS_KEY R2 API 令牌密钥
//   R2_PUBLIC_URL        桶公开访问地址，如 https://<bucket>.r2.dev 或自定义域
//
// 未配置时 isR2Configured() 返回 false，统一入口 storeCover() 会自动降级为
// 把封面写入仓库 public/covers/<prefix>/（站内相对路径），无需任何信用卡。

import { createHash, createHmac } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join, extname, basename } from 'node:path';

const R2_ENDPOINT_HOST = (accountId) => `${accountId}.r2.cloudflarestorage.com`;

const EXT_BY_CT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

export function isR2Configured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_BUCKET &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY,
  );
}

export function r2PublicUrl(key) {
  const base = (process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '');
  return `${base}/${key}`;
}

function hmac(key, data) {
  return createHmac('sha256', key).update(data).digest();
}

function sha256Hex(input) {
  return createHash('sha256').update(input).digest('hex');
}

function amzDate(d = new Date()) {
  // 2026-09-25T13:51:08.123Z → 20260925T135108Z
  return d.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 17);
}

function extFromUrl(u) {
  const m = u.pathname.match(/\.([a-z0-9]+)(?:[?#]|$)/i);
  return m ? m[1].toLowerCase() : '';
}

function isUrl(s) {
  return /^https?:\/\//i.test(s);
}

/**
 * 把二进制对象 PUT 到 R2 桶的 key 路径下。
 * @param {string} key        对象键，如 videos/coffee-art.jpg
 * @param {Buffer|Uint8Array} body 图片二进制
 * @param {string} contentType 如 image/jpeg
 * @returns {Promise<string>} 公开访问 URL
 */
export async function putObject(key, body, contentType = 'application/octet-stream') {
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET;
  const accessKey = process.env.R2_ACCESS_KEY_ID;
  const secretKey = process.env.R2_SECRET_ACCESS_KEY;
  const region = 'auto';
  const service = 's3';
  const host = R2_ENDPOINT_HOST(accountId);
  const url = `https://${host}/${bucket}/${key}`;

  const payloadHash = sha256Hex(body);
  const t = amzDate();
  const dateStamp = t.slice(0, 8);

  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${t}\n`;

  const canonicalRequest = [
    'PUT',
    `/${bucket}/${key}`,
    '', // 无查询串
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    t,
    scope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = hmac('AWS4' + secretKey, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'content-type': contentType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': t,
      Authorization: authorization,
    },
    body,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`R2 PUT ${res.status}: ${txt.slice(0, 300)}`);
  }
  return r2PublicUrl(key);
}

/**
 * 从远程 URL 抓取封面并存入 R2。
 * @returns {Promise<string>} 公开访问 URL
 */
export async function storeCoverFromUrl(sourceUrl, slug, { prefix = 'videos' } = {}) {
  const res = await fetch(sourceUrl, { redirect: 'follow' });
  if (!res.ok) throw new Error(`fetch cover HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = res.headers.get('content-type') || '';
  const ext = EXT_BY_CT[ct] || extFromUrl(new URL(sourceUrl)) || 'jpg';
  const key = `${prefix}/${slug}.${ext}`;
  return putObject(key, buf, ct || 'application/octet-stream');
}

/**
 * 从本地文件读取封面并存入 R2。
 * @returns {Promise<string>} 公开访问 URL
 */
export async function storeCoverFromFile(filePath, slug, { prefix = 'videos' } = {}) {
  const { readFile } = await import('node:fs/promises');
  const buf = await readFile(filePath);
  const ext = extFromUrl(new URL(`file://${filePath}`)) || 'jpg';
  const ct = EXT_BY_CT['image/' + ext] ? 'image/' + ext : 'application/octet-stream';
  const key = `${prefix}/${slug}.${ext}`;
  return putObject(key, buf, ct);
}

/**
 * 把封面落到仓库 public/covers 本地目录（无 R2 时的降级路径）。
 * 仓库只记录返回的站内相对路径，二进制随站点部署——零信用卡、零配置。
 * @returns {Promise<string>} 站内相对路径，如 /covers/videos/<slug>.jpg
 */
export async function storeCoverLocal(source, slug, { prefix = 'videos', localDir } = {}) {
  if (!localDir) throw new Error('localDir required for local cover fallback');
  let buf;
  let ct = '';
  if (isUrl(source)) {
    const res = await fetch(source, { redirect: 'follow' });
    if (!res.ok) throw new Error(`fetch cover HTTP ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
    ct = res.headers.get('content-type') || '';
  } else {
    const { readFile } = await import('node:fs/promises');
    buf = await readFile(source);
  }
  const ext = isUrl(source)
    ? EXT_BY_CT[ct] || extFromUrl(new URL(source)) || 'jpg'
    : extname(source).replace(/^\./, '') || 'jpg';
  const dir = resolve(localDir, prefix);
  await mkdir(dir, { recursive: true });
  const filename = `${slug}.${ext}`;
  await writeFile(join(dir, filename), buf);
  const webBase = '/' + basename(localDir); // public/covers -> /covers
  return `${webBase}/${prefix}/${filename}`;
}

/**
 * 统一封面存储入口：配了 R2 走 R2（返回绝对公开 URL），否则落仓库本地目录（返回站内相对路径）。
 * @param {string} source 远程 URL 或本地文件路径
 * @param {string} slug
 * @param {{prefix?:string, localDir?:string, allowLocal?:boolean}} [opts]
 * @returns {Promise<string>} 可写入 coverUrl 的地址
 */
export async function storeCover(source, slug, { prefix = 'videos', localDir, allowLocal = true } = {}) {
  if (isR2Configured()) {
    return isUrl(source)
      ? await storeCoverFromUrl(source, slug, { prefix })
      : await storeCoverFromFile(source, slug, { prefix });
  }
  if (allowLocal) {
    if (!localDir) throw new Error('localDir required for local cover fallback');
    return await storeCoverLocal(source, slug, { prefix, localDir });
  }
  throw new Error('R2 not configured and local fallback disabled');
}
