// 平台适配器 —— 把各站榜单页 / 接口归一化为统一条目结构。
//
// 每个适配器返回：{ slug, frontmatter, body }[]
// frontmatter 字段与 src/content/config.ts 的 Schema 对齐。
//
// 重要：解析是基于公开榜单页 HTML 的"尽力而为"实现。各站会改版，
// 因此每条采集结果都会先落盘到 data/pending/ 待人工复核，绝不直接进 src/content。
import { fetchText, fetchJSON, MOBILE_UA } from './fetch.mjs';

/* ----------------------------- 通用解析工具 ----------------------------- */

function allAnchors(html) {
  const out = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) out.push({ attrs: m[1], inner: m[2] });
  return out;
}

function attr(attrs, name) {
  const m = attrs.match(new RegExp(`${name}="([^"]*)"`, 'i'));
  return m ? m[1] : '';
}

function stripTags(s) {
  return String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function imgSrc(inner) {
  const m = inner.match(/<img\b[^>]*src="([^"]+)"/i);
  return m ? m[1] : '';
}

function mapLang(name = '') {
  const n = String(name).toLowerCase();
  if (n.includes('chinese') || n.includes('中文') || n === 'zh') return 'zh';
  return 'en';
}

/** Wattpad 没有公开评分字段，用 赞/读 比粗略折算 10 分制 */
function approxRating(votes, reads) {
  if (!votes || !reads) return undefined;
  return Math.min(10, Math.round((votes / reads) * 100 * 100) / 100);
}

/**
 * 从一批 anchor 中按平台 id 正则去重，提取 {id, href, title, cover}。
 * 标题优先级：anchor 文本 → <img alt> → id，避免图片型条目（如快看）因标题为空被整体跳过。
 */
function collectByAnchor(html, { hrefRe, idRe, host = '' }) {
  const anchors = allAnchors(html).filter((a) => hrefRe.test(attr(a.attrs, 'href')));
  const seen = new Set();
  const items = [];
  for (const a of anchors) {
    let href = attr(a.attrs, 'href');
    if (!/^https?:/i.test(href)) href = host + href;
    const id = (href.match(idRe) || [])[1];
    if (!id || seen.has(id)) continue;
    const textTitle = stripTags(a.inner).slice(0, 80);
    const altTitle = (a.inner.match(/alt="([^"]*)"/i) || [])[1] || '';
    const title = (textTitle || altTitle || id).trim();
    seen.add(id);
    items.push({ id, href, title, cover: imgSrc(a.inner) });
  }
  return items;
}

function base(collection, platform, language, origin) {
  return { collection, platform, language, origin };
}

/* ------------------------------- 漫画适配器 ------------------------------ */

export async function webtoon() {
  const html = await fetchText('https://www.webtoons.com/en/ranking', { timeout: 20000 });
  const items = collectByAnchor(html, {
    hrefRe: /title_no=\d+/i,
    idRe: /title_no=(\d+)/i,
  });
  return items.map((c, i) => ({
    slug: 'webtoon-' + c.id,
    frontmatter: {
      title: c.title,
      author: '',
      platform: 'Webtoon',
      sourceUrl: c.href,
      coverUrl: c.cover || undefined,
      language: 'en',
      status: 'ongoing',
      pubDate: new Date(),
      sourceId: 'webtoon:' + c.id,
      origin: 'html',
      metrics: { rank: i + 1 },
    },
    body: 'Auto-harvested from Webtoon ranking. 上线前请核对作者 / 封面。\n',
  }));
}

export async function tapas() {
  // 注意：Tapas 榜单页是 SPA，静态 HTML 不含作品直链，纯 HTML 解析会得 0 条。
  // 真实采集需走 Tapas 内部 API（待接入）；此处先指向可达页面，避免 404 误报。
  const html = await fetchText('https://tapas.io/top', { timeout: 20000 });
  const items = collectByAnchor(html, {
    hrefRe: /\/series\/[a-z0-9-]+/i,
    idRe: /\/series\/([a-z0-9-]+)/i,
    host: 'https://tapas.io',
  });
  return items.map((c, i) => ({
    slug: 'tapas-' + c.id,
    frontmatter: {
      title: c.title,
      author: '',
      platform: 'Tapas',
      sourceUrl: c.href,
      coverUrl: c.cover || undefined,
      language: 'en',
      status: 'ongoing',
      pubDate: new Date(),
      sourceId: 'tapas:' + c.id,
      origin: 'html',
      metrics: { rank: i + 1 },
    },
    body: 'Auto-harvested from Tapas top series. 上线前请核对作者 / 封面。\n',
  }));
}

export async function qq() {
  const html = await fetchText('https://ac.qq.com/Rank/comicRank', { timeout: 20000 });
  const items = collectByAnchor(html, {
    hrefRe: /Comic\/comicInfo\/id\/\d+/i,
    idRe: /id\/(\d+)/i,
    host: 'https://ac.qq.com',
  });
  return items.map((c, i) => ({
    slug: 'qq-' + c.id,
    frontmatter: {
      title: c.title,
      author: '',
      platform: '腾讯动漫',
      sourceUrl: c.href,
      coverUrl: c.cover || undefined,
      language: 'zh',
      status: 'ongoing',
      pubDate: new Date(),
      sourceId: 'qq:' + c.id,
      origin: 'html',
      metrics: { rank: i + 1 },
    },
    body: '自动采集自腾讯动漫排行榜，上线前请核对作者 / 封面。\n',
  }));
}

export async function kuaikan() {
  // 快看对桌面 UA 返回空壳，必须移动端 UA 才能拿到 SSR 条目
  const html = await fetchText('https://www.kuaikanmanhua.com/ranking/', {
    timeout: 20000,
    ua: MOBILE_UA,
  });
  const items = collectByAnchor(html, {
    hrefRe: /\/topic\/\d+/i,
    idRe: /\/topic\/(\d+)/i,
    host: 'https://www.kuaikanmanhua.com',
  });
  return items.map((c, i) => ({
    slug: 'kuaikan-' + c.id,
    frontmatter: {
      title: c.title,
      author: '',
      platform: '快看',
      sourceUrl: c.href,
      coverUrl: c.cover || undefined,
      language: 'zh',
      status: 'ongoing',
      pubDate: new Date(),
      sourceId: 'kuaikan:' + c.id,
      origin: 'html',
      metrics: { rank: i + 1 },
    },
    body: '自动采集自快看排行榜，上线前请核对作者 / 封面。\n',
  }));
}

/* ------------------------------- 小说适配器 ------------------------------ */

export async function wattpad(src) {
  // 优先走公开 API；不可达时回退到榜单页解析（Wattpad 在 CI / 真实服务器通常可达）。
  try {
    const url = `https://api.wattpad.com/api/v3/stories?filter=hot&limit=${
      src.limit || 20
    }&fields=id,title,user(name),cover,readCount,voteCount,numParts,completed,mature,language(name),tags,modifyDate,url`;
    const json = await fetchJSON(url);
    return (json.stories || []).map((s) => ({
      slug: 'wattpad-' + s.id,
      frontmatter: {
        title: s.title,
        author: s.user?.name || 'Unknown',
        platform: 'Wattpad',
        sourceUrl: s.url,
        coverUrl: s.cover?.['512x512'] || s.cover?.original || s.cover || undefined,
        language: mapLang(s.language?.name),
        tags: s.tags || [],
        status: s.completed ? 'completed' : 'ongoing',
        pubDate: new Date(s.modifyDate || Date.now()),
        sourceId: 'wattpad:' + s.id,
        origin: 'api',
        metrics: { views: s.readCount, rating: approxRating(s.voteCount, s.readCount) },
      },
      body: '',
    }));
  } catch {
    const html = await fetchText('https://www.wattpad.com/stories/hot', { timeout: 20000 });
    const items = collectByAnchor(html, {
      hrefRe: /wattpad\.com\/story\/\d+/i,
      idRe: /story\/(\d+)/i,
    });
    return items.map((c, i) => ({
      slug: 'wattpad-' + c.id,
      frontmatter: {
        title: c.title,
        author: '',
        platform: 'Wattpad',
        sourceUrl: c.href,
        coverUrl: c.cover || undefined,
        language: 'en',
        tags: [],
        status: 'ongoing',
        pubDate: new Date(),
        sourceId: 'wattpad:' + c.id,
        origin: 'html',
        metrics: { rank: i + 1 },
      },
      body: 'Auto-harvested (HTML fallback) from Wattpad. 上线前请核对。\n',
    }));
  }
}

export async function webnovel() {
  // Webnovel 榜单为 SPA（/rank 静态页无作品直链），真实采集需走其接口（待接入）。
  // 此处保留 HTML 兜底以便将来接 API 后切换；当前多半为 0 条。
  const html = await fetchText('https://www.webnovel.com/rank', { timeout: 20000 });
  const items = collectByAnchor(html, {
    hrefRe: /\/book\/\d+/i,
    idRe: /\/book\/(\d+)/i,
    host: 'https://www.webnovel.com',
  });
  return items.map((c, i) => ({
    slug: 'webnovel-' + c.id,
    frontmatter: {
      title: c.title,
      author: '',
      platform: 'Webnovel',
      sourceUrl: c.href,
      coverUrl: c.cover || undefined,
      language: 'en',
      status: 'ongoing',
      pubDate: new Date(),
      sourceId: 'webnovel:' + c.id,
      origin: 'html',
      metrics: { rank: i + 1 },
    },
    body: 'Auto-harvested from Webnovel ranking. 上线前请核对作者 / 封面。\n',
  }));
}

export async function wuxiaworld() {
  // Wuxiaworld 列表页为 SPA（静态 HTML 不含 /novel/ 直链），纯 HTML 解析会得 0 条。
  // 真实采集需解析其内嵌 JSON 或接口（待接入）。
  const html = await fetchText('https://www.wuxiaworld.com/novel-list', { timeout: 20000 });
  const items = collectByAnchor(html, {
    hrefRe: /\/novel\/[a-z0-9-]+/i,
    idRe: /\/novel\/([a-z0-9-]+)/i,
    host: 'https://www.wuxiaworld.com',
  });
  return items.map((c, i) => ({
    slug: 'wuxiaworld-' + c.id,
    frontmatter: {
      title: c.title,
      author: '',
      platform: 'Wuxiaworld',
      sourceUrl: c.href,
      coverUrl: c.cover || undefined,
      language: 'en',
      status: 'ongoing',
      pubDate: new Date(),
      sourceId: 'wuxiaworld:' + c.id,
      origin: 'html',
      metrics: { rank: i + 1 },
    },
    body: 'Auto-harvested from Wuxiaworld. 上线前请核对。\n',
  }));
}

export async function qidian() {
  // 起点强反爬（腾讯），静态 HTML 解析大概率 0 条，需 API / 移动端；此处先尽力而为。
  const html = await fetchText('https://www.qidian.com/rank/', { timeout: 20000, ua: MOBILE_UA });
  const items = collectByAnchor(html, {
    hrefRe: /\/(?:book|info)\/\d+/i,
    idRe: /\/(?:book|info)\/(\d+)/i,
    host: 'https://www.qidian.com',
  });
  return items.map((c, i) => ({
    slug: 'qidian-' + c.id,
    frontmatter: {
      title: c.title,
      author: '',
      platform: '起点',
      sourceUrl: c.href,
      coverUrl: c.cover || undefined,
      language: 'zh',
      status: 'ongoing',
      pubDate: new Date(),
      sourceId: 'qidian:' + c.id,
      origin: 'html',
      metrics: { rank: i + 1 },
    },
    body: '自动采集自起点排行榜，上线前请核对作者 / 封面。\n',
  }));
}

export async function xiaoshuohui() {
  // 小说会排行榜；链接形态待 CI 验证，先以常见 /book|/novel|/info/<id> 模式尽力解析。
  const html = await fetchText('https://www.xiaoshuohui.com.cn/top/', { timeout: 20000, ua: MOBILE_UA });
  const items = collectByAnchor(html, {
    hrefRe: /\/(?:book|novel|info)\/\d+/i,
    idRe: /\/(?:book|novel|info)\/(\d+)/i,
    host: 'https://www.xiaoshuohui.com.cn',
  });
  return items.map((c, i) => ({
    slug: 'xiaoshuohui-' + c.id,
    frontmatter: {
      title: c.title,
      author: '',
      platform: '小说会',
      sourceUrl: c.href,
      coverUrl: c.cover || undefined,
      language: 'zh',
      status: 'ongoing',
      pubDate: new Date(),
      sourceId: 'xiaoshuohui:' + c.id,
      origin: 'html',
      metrics: { rank: i + 1 },
    },
    body: '自动采集自小说会排行榜，上线前请核对作者 / 封面。\n',
  }));
}

export const ADAPTERS = {
  webtoon,
  tapas,
  qq,
  kuaikan,
  wattpad,
  webnovel,
  wuxiaworld,
  qidian,
  xiaoshuohui,
};
