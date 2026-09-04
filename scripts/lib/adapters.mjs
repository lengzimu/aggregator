// 平台适配器 —— 把各站榜单页 / 接口归一化为统一条目结构。
//
// 每个适配器返回：{ slug, frontmatter, body }[]
// frontmatter 字段与 src/content/config.ts 的 Schema 对齐。
//
// 重要：解析是基于公开榜单页 HTML / 接口的"尽力而为"实现。各站会改版，
// 因此每条采集结果都会先落盘到 data/pending/ 待人工复核，绝不直接进 src/content。
import { fetchText, fetchJSON, DESKTOP_UA, MOBILE_UA } from './fetch.mjs';

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

/** 从对象里按候选键名取第一个非空值（兼容不同站字段命名） */
function pick(obj, keys) {
  for (const k of keys) if (obj[k] != null && obj[k] !== '') return obj[k];
  return undefined;
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
  // Tapas 榜单为 SPA，数据由前端 XHR 从私有 API（api.tapas.io，未公开排行榜端点）拉取，
  // 静态 HTML 无作品直链、页面也不含内嵌数据 → 纯 HTML 解析恒为 0。
  // 需无头浏览器或更深 RE 才能采；当前保留兜底以免误报，实际 0 条。
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
  // Webnovel 榜单为 SPA，走其 JSON 接口 /go/pcm/category/getRankList（第三方已验证可用）。
  // 该接口需要 _csrfToken：先从榜单页取 set-cookie 里的 _csrfToken，再带 cookie 调接口。
  // 注：本适配器未经沙箱验证（webnovel 在本环境出口被拦），需在 CI / 开放网络复测。
  const rankPage = 'https://www.webnovel.com/ranking/novel/all_time/popular_rank';
  let csrf = '';
  let cookie = '';
  try {
    const pageRes = await fetch(rankPage, {
      headers: { 'User-Agent': DESKTOP_UA },
      redirect: 'follow',
    });
    const sc = pageRes.headers.get('set-cookie') || '';
    const m = sc.match(/_csrfToken=([^;]+)/);
    if (m) csrf = m[1];
    cookie = sc;
  } catch {
    /* 取不到 token 时仍尝试不带 token 调用 */
  }

  const api = new URL('https://www.webnovel.com/go/pcm/category/getRankList');
  const params = {
    _csrfToken: csrf,
    pageIndex: '1',
    rankId: 'popular_rank',
    listType: '0',
    type: '1',
    rankName: 'Popular',
    timeType: '3',
    sourceType: '2',
    sex: '1',
  };
  Object.entries(params).forEach(([k, v]) => api.searchParams.set(k, v));

  const headers = {
    'User-Agent': DESKTOP_UA,
    Accept: 'application/json, text/javascript, */*; q=0.01',
    Referer: rankPage,
    'X-Requested-With': 'XMLHttpRequest',
  };
  if (cookie) headers.Cookie = cookie;

  const json = await fetchJSON(api.toString(), { headers });
  const items = (json?.data?.bookItems || [])
    .map((b) => {
      const id = String(pick(b, ['bookId', 'id', 'bookIdStr']) ?? '');
      const title = pick(b, ['bookName', 'name', 'title']) || '';
      const url = pick(b, ['bookUrl', 'url', 'bookLink']) || `https://www.webnovel.com/book/${id}`;
      const cover = pick(b, ['coverUrl', 'bookCover', 'cover']) || '';
      return { id, href: url, title, cover };
    })
    .filter((c) => c.id);
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
      origin: 'api',
      metrics: { rank: i + 1 },
    },
    body: 'Auto-harvested from Webnovel ranking API. 上线前请核对作者 / 封面。\n',
  }));
}

export async function wuxiaworld() {
  // Wuxiaworld 列表页为 SPA：数据由前端 React Query 从私有 API 拉取，
  // 页面 window.__REACT_QUERY_STATE__ 为空、无内嵌数据、也无公开排行榜端点 → 纯 HTML 解析恒为 0。
  // 需无头浏览器或更深 RE 才能采；当前保留兜底以免误报，实际 0 条。
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
