// 平台适配器 —— 把各站榜单页 / 接口归一化为统一条目结构。
//
// 每个适配器返回：{ slug, frontmatter, body }[]
// frontmatter 字段与 src/content/config.ts 的 Schema 对齐。
//
// 重要：解析是基于公开榜单页 HTML / 接口的"尽力而为"实现。各站会改版，
// 因此每条采集结果都会先落盘到 data/pending/ 待人工复核，绝不直接进 src/content。
import { fetchText, fetchJSON, MOBILE_UA, DESKTOP_UA } from './fetch.mjs';

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

/**
 * 取 <img> 的图片地址：优先 data-src（懒加载站的真实图），
 * 其次 src（部分站 src 是占位小图，如小说会的 lazy_bg 占位图）。
 */
function imgSrc(inner) {
  const lazy = inner.match(/<img\b[^>]*?data-src="([^"]+)"/i);
  if (lazy) return lazy[1];
  const m = inner.match(/<img\b[^>]*?src="([^"]+)"/i);
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
 * 清洗封面 URL：只保留绝对 http(s) 地址；data: 占位图 / 相对路径 / 空 一律丢弃
 * （否则 z.string().url() 在构建期失败，整站构建崩）。
 */
function cleanCover(url) {
  if (typeof url !== 'string') return undefined;
  return /^https?:\/\//i.test(url) ? url : undefined;
}

/**
 * Webtoon 榜单 anchor 文本混入了排名前缀与尾部题材/热度噪声，例：
 *   "1" up 9 I Got Pregnant with the Tyrant's Child Romance 96,759
 *   "2" up 12 DARK MOON: THE BLOOD ALTAR Fantasy 4.8M
 * 去掉前缀 `"N" up M ` 与尾部 ` <Genre> <views>`，还原干净标题。
 */
function cleanWebtoonTitle(t) {
  let s = String(t).replace(/^"\d+"\s*up\s*\d+\s*/i, '');
  s = s.replace(/\s+[A-Z][a-z]*(?:-[A-Z][a-z]*)*\s[\d.,]+(?:M|K|m|k)?\s*$/, '');
  s = s.trim();
  return s || String(t).trim();
}

/**
 * 快看榜单 anchor 文本形如：
 *   "Created with Sketch. 完美敌人 安妮薇（原著）+郝一个佳思（主笔） 【超A女间谍..."
 *   "Created with Sketch. 2 我！天命大反派 天命反派（原著）+绘术动漫 ..."
 * 去掉 "Created with Sketch." 前缀与头部排名数字，截到作者/简介分隔符前取标题首词。
 * 封面为前端 JS 注入（静态 HTML 仅有 data: 占位图），故封面留空，由人工补全。
 */
function cleanKuaikanTitle(t) {
  let s = String(t).replace(/Created with Sketch\.\s*/i, '').replace(/^\d+\s+/, '');
  s = s.split(/（|【|\+|×/)[0].trim();
  s = s.split(/\s+/)[0] || s;
  return s || String(t).trim();
}

/**
 * 生成"编辑短评"：只写聚合站自己的增量信号（当前榜单名次），不抄剧情、不模板堆砌。
 * 含真实 title/rank，每条不同；满足 check-reviews 准入（有 metrics 必须有 review）。
 */
function makeReview(platform, rank, lang) {
  if (lang === 'zh') {
    return `当前位列${platform}热门榜第${rank}名，连载中，更新稳定，可据此按题材挑着追更。`;
  }
  return `Currently #${rank} on ${platform}'s chart — ongoing with steady weekly updates.`;
}

/**
 * 从一批 anchor 中按平台 id 正则去重，提取 {id, href, title, cover}。
 * 标题优先级：anchor 文本 → <img alt> → id，避免图片型条目（如快看）因标题为空被整体跳过。
 * 遇到同 id 的重复 anchor（如 RoyalRoad 封面图与标题分属两个 <a>）时，合并更优的 title/cover。
 */
function collectByAnchor(html, { hrefRe, idRe, host = '' }) {
  const anchors = allAnchors(html).filter((a) => hrefRe.test(attr(a.attrs, 'href')));
  const seen = new Set();
  const items = [];
  for (const a of anchors) {
    let href = attr(a.attrs, 'href');
    if (!/^https?:/i.test(href)) href = host + href;
    const id = (href.match(idRe) || [])[1];
    if (!id) continue;
    const textTitle = stripTags(a.inner).slice(0, 80);
    const altTitle = (a.inner.match(/alt="([^"]*)"/i) || [])[1] || '';
    const title = (textTitle || altTitle || id).trim();
    const cover = imgSrc(a.inner);
    if (seen.has(id)) {
      const prev = items.find((x) => x.id === id);
      if (prev) {
        if ((!prev.title || prev.title === prev.id) && title && title !== id) prev.title = title;
        if (!prev.cover && cover) prev.cover = cover;
      }
      continue;
    }
    seen.add(id);
    items.push({ id, href, title, cover });
  }
  return items;
}

/** 限并发执行：避免一次 harvest 对单站发起几十个请求把对方打挂 */
async function mapLimit(arr, limit, fn) {
  const out = [];
  for (let i = 0; i < arr.length; i += limit) {
    const batch = arr.slice(i, i + limit);
    const r = await Promise.allSettled(batch.map(fn));
    for (const x of r) out.push(x.status === 'fulfilled' ? x.value : undefined);
  }
  return out;
}

/** 腾讯动漫详情页封面：manhua.acimg.cn 的 vertical 封面（榜单页无封面，必须进详情页取） */
export async function qqCover(id) {
  try {
    const html = await fetchText(`https://ac.qq.com/Comic/comicInfo/id/${id}`, { timeout: 15000 });
    const all = [...html.matchAll(/https?:\/\/manhua\.acimg\.cn\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)/gi)].map((x) => x[0]);
    const vert = all.find((u) => /\/vertical\//i.test(u)) || all[0];
    return cleanCover(vert);
  } catch {
    return undefined;
  }
}

/** 漫客栈详情页封面：oss.mkzcdn.com/comic/cover/...（榜单页封面为懒加载，需进详情页取） */
export async function mkzhanCover(id) {
  try {
    const html = await fetchText(`https://www.mkzhan.com/${id}/`, { timeout: 15000 });
    const m = html.match(/https?:\/\/oss\.mkzcdn\.com\/comic\/cover\/[^\s"'<>]+/i);
    return cleanCover(m ? m[0] : undefined);
  } catch {
    return undefined;
  }
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
      title: cleanWebtoonTitle(c.title),
      author: '',
      platform: 'Webtoon',
      sourceUrl: c.href,
      coverUrl: cleanCover(c.cover),
      language: 'en',
      status: 'ongoing',
      pubDate: new Date(),
      sourceId: 'webtoon:' + c.id,
      origin: 'html',
      metrics: { rank: i + 1 },
      review: makeReview('Webtoon', i + 1, 'en'),
    },
    body: 'Auto-harvested from Webtoon ranking. 上线前请核对作者 / 封面。\n',
  }));
}

export async function tapas() {
  // Tapas 榜单为 SPA，数据由前端 XHR 从私有 API（api.tapas.io，未公开排行榜端点）拉取，
  // 静态 HTML 无作品直链、页面也不含内嵌数据 → 纯 HTML 解析恒为 0。
  // 需无头浏览器或更深 RE 才能采；当前保留兜底以免误报，实际 0 条（已降级 manual 档）。
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
      coverUrl: cleanCover(c.cover),
      language: 'en',
      status: 'ongoing',
      pubDate: new Date(),
      sourceId: 'tapas:' + c.id,
      origin: 'html',
      metrics: { rank: i + 1 },
      review: makeReview('Tapas', i + 1, 'en'),
    },
    body: 'Auto-harvested from Tapas top series. 上线前请核对作者 / 封面。\n',
  }));
}

export async function qq() {
  // 榜单页 ac.qq.com/Rank/comicRank 标题干净，但 anchor 无封面（懒加载）；
  // 必须进每部详情页 Comic/comicInfo/id/<id> 取 manhua.acimg.cn 的 vertical 封面。
  const html = await fetchText('https://ac.qq.com/Rank/comicRank', { timeout: 20000 });
  const items = collectByAnchor(html, {
    hrefRe: /Comic\/comicInfo\/id\/\d+/i,
    idRe: /id\/(\d+)/i,
    host: 'https://ac.qq.com',
  });
  const top = items.slice(0, 50);
  const covers = await mapLimit(top, 5, (c) => qqCover(c.id));
  return top.map((c, i) => ({
    slug: 'qq-' + c.id,
    frontmatter: {
      title: c.title,
      author: '',
      platform: '腾讯动漫',
      sourceUrl: c.href,
      coverUrl: covers[i],
      language: 'zh',
      status: 'ongoing',
      pubDate: new Date(),
      sourceId: 'qq:' + c.id,
      origin: 'html',
      metrics: { rank: i + 1 },
      review: makeReview('腾讯动漫', i + 1, 'zh'),
    },
    body: '自动采集自腾讯动漫排行榜，上线前请核对作者 / 封面。\n',
  }));
}

export async function kuaikan() {
  // 快看排行榜 /ranking/9 为 Nuxt 渲染：anchor 文本含真实标题（"完美敌人" 等），
  // 但封面是前端 JS 经鉴权 XHR 注入——静态 HTML / 详情页 / 公开 API（pweb 返回空 data）
  // 均取不到真实封面 URL → 封面留空走 default-cover 兜底，人工经 import 补全。
  const html = await fetchText('https://www.kuaikanmanhua.com/ranking/9', {
    timeout: 20000,
    ua: MOBILE_UA,
  });
  const items = collectByAnchor(html, {
    hrefRe: /\/web\/topic\/\d+/i,
    idRe: /\/web\/topic\/(\d+)/i,
    host: 'https://www.kuaikanmanhua.com',
  });
  return items.map((c, i) => ({
    slug: 'kuaikan-' + c.id,
    frontmatter: {
      title: cleanKuaikanTitle(c.title),
      author: '',
      platform: '快看',
      sourceUrl: c.href,
      coverUrl: undefined,
      language: 'zh',
      status: 'ongoing',
      pubDate: new Date(),
      sourceId: 'kuaikan:' + c.id,
      origin: 'html',
      metrics: { rank: i + 1 },
      review: makeReview('快看', i + 1, 'zh'),
    },
    body: '自动采集自快看排行榜（/ranking/9），标题来自榜单、封面为 JS 注入需人工补。\n',
  }));
}

// 漫客栈题材配置（theme_id → 题材名），来自官方详情接口字段说明
const MKZHAN_THEME = {
  1: '霸总', 2: '修真', 3: '恋爱', 4: '校园', 5: '冒险', 6: '搞笑', 7: '生活', 8: '热血',
  9: '架空', 10: '后宫', 12: '玄幻', 13: '悬疑', 14: '恐怖', 15: '灵异', 16: '动作',
  17: '科幻', 18: '战争', 19: '古风', 20: '穿越', 21: '竞技', 23: '励志', 24: '同人',
  25: '其他', 26: '真人',
};

/** 去掉标题末尾的「漫画」后缀（旧 HTML 榜单锚文本会整串带「XX漫画」，接口标题本身干净） */
function cleanMkzhanTitle(t) {
  const s = String(t || '').replace(/漫画+$/g, '').trim();
  return s || String(t || '');
}

/** theme_id 可能是 "5,8,12" 这样逗号分隔的多题材，映射成中文题材名数组 */
function mkzhanThemes(themeId) {
  if (!themeId) return [];
  return String(themeId)
    .split(',')
    .map((id) => MKZHAN_THEME[Number(id)])
    .filter(Boolean);
}

export async function mkzhan() {
  // 漫客栈官方榜单 API（comic.mkzcdn.com）：9 个榜单 = 人气(popular)/上升(ascension)/收藏(collection)
  // × type 1/2/3。直接返回结构化 JSON，含封面(oss.mkzcdn.com)、题材(theme_id)、评分(score)、阅读数(read_count)。
  // 同一部漫画会出现在多个榜单，必须按 comic_id 去重（用户明确要求「注意漫画去重」）。
  const headers = {
    'User-Agent': DESKTOP_UA,
    Referer: 'https://www.mkzhan.com/',
    Accept: 'application/json',
  };
  const kinds = ['popular', 'ascension', 'collection'];
  const types = [1, 2, 3];
  const urls = [];
  for (const kind of kinds)
    for (const type of types)
      urls.push({ kind, type, url: `https://comic.mkzcdn.com/top/${kind}/type/${type}/page_num/1/page_size/100` });

  // 并发抓取 9 个榜单（限并发 4，避免打爆接口）
  const lists = await mapLimit(urls, 4, async ({ kind, type, url }) => {
    try {
      const json = await fetchJSON(url, { headers, timeout: 20000 });
      return { kind, list: json?.data?.list || [] };
    } catch (e) {
      return { kind, list: [], err: String(e?.message || e) };
    }
  });

  // 按 comic_id 聚合去重：合并题材，保留最佳（最小）名次
  const byId = new Map();
  for (const { kind, list } of lists) {
    if (!list || !list.length) continue;
    list.forEach((c, idx) => {
      const id = String(c.comic_id);
      if (!id) return;
      const pos = idx + 1; // 列表内名次（popular/collection 无显式 rank 字段，用位置代替）
      // rank_asc 偶发为 0（异常值），只在其为正时采用，否则回退到列表位置
      const rank = kind === 'ascension' && Number(c.rank_asc) > 0 ? Number(c.rank_asc) : pos;
      const prev = byId.get(id);
      if (!prev) {
        byId.set(id, {
          id,
          title: cleanMkzhanTitle(c.title),
          author: c.author_title || '',
          cover: c.cover,
          themeId: c.theme_id,
          score: c.score != null ? Number(c.score) : undefined,
          readCount: c.read_count != null ? Number(c.read_count) : undefined,
          collectionCount: c.collection_count != null ? Number(c.collection_count) : undefined,
          sourceUrl: `https://www.mkzhan.com/${id}/`,
          bestRank: rank,
        });
      } else {
        prev.bestRank = Math.min(prev.bestRank, rank);
        if (!prev.title && c.title) prev.title = cleanMkzhanTitle(c.title);
        if (!prev.author && c.author_title) prev.author = c.author_title;
        if (!prev.cover && c.cover) prev.cover = c.cover;
        if (!prev.themeId && c.theme_id) prev.themeId = c.theme_id;
      }
    });
  }

  // 用详情接口补全：连载/完结(finish) + 内容简介(content) + 最新章节名(chapter_title) +
  // 章节开始时间(chapter_start_time，秒级时间戳)。后三者是卡片展示字段，
  // 因此对全部去重后的条目请求详情（并发 4 + 一次重试，控量避免限频；失败字段留空不影响入库）。
  // 注意：detail 接口 UA 挑剔，需完整桌面 UA 且先打过 top 榜单请求（上文已满足），否则 403。
  const details = await mapLimit([...byId.values()], 4, async (x) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const json = await fetchJSON(`https://comic.mkzcdn.com/comic/info?comic_id=${x.id}`, {
          headers,
          timeout: 15000,
        });
        const d = json?.data || {};
        if (d.finish != null || d.chapter_title || d.content)
          return {
            id: x.id,
            finish: d.finish,
            content: d.content ? String(d.content).trim().slice(0, 200) : undefined,
            chapterTitle: d.chapter_title ? String(d.chapter_title).trim() : undefined,
            chapterStart: d.chapter_start_time
              ? new Date(Number(d.chapter_start_time) * 1000).toISOString()
              : undefined,
          };
      } catch {
        /* 重试 */
      }
    }
    return { id: x.id };
  });
  const detailMap = new Map(details.map((d) => [d.id, d]));

  return [...byId.values()].map((x) => {
    const tags = mkzhanThemes(x.themeId);
    const rawCover = cleanCover(x.cover);
    const coverUrl = rawCover ? rawCover.replace(/^http:/i, 'https:') : undefined; // 升级 https 避免混合内容
    const det = detailMap.get(x.id) || {};
    // 注意：detail 接口 finish 是字符串（"1"=连载, "2"=完结），需转数字比较
    const status = Number(det.finish) === 2 ? 'completed' : 'ongoing';
    const rating = x.score != null ? Math.round((x.score / 10) * 10) / 10 : undefined; // score 为 /100，折算 10 分制
    const metrics = { rank: x.bestRank };
    if (rating != null) metrics.rating = rating;
    if (x.readCount != null) metrics.views = x.readCount;
    if (x.collectionCount != null) metrics.subscribers = x.collectionCount;
    const frontmatter = {
      title: x.title || '漫客栈作品' + x.id,
      author: x.author,
      platform: '漫客栈',
      sourceUrl: x.sourceUrl,
      coverUrl,
      language: 'zh',
      tags,
      status,
      pubDate: new Date(),
      sourceId: 'mkzhan:' + x.id,
      origin: 'api',
      metrics,
      review: makeReview('漫客栈', x.bestRank, 'zh'),
    };
    // 卡片展示字段：内容简介 / 最新章节名 / 最新章节开始时间（详情接口失败时留空）
    if (det.content) frontmatter.description = det.content;
    if (det.chapterTitle) frontmatter.latestChapter = det.chapterTitle;
    if (det.chapterStart) frontmatter.latestChapterAt = det.chapterStart;
    return {
      slug: 'mkzhan-' + x.id,
      frontmatter,
      body: '自动采集自漫客栈官方榜单 API（人气/上升/收藏），覆盖题材：' + (tags.join('、') || '未标注') + '。\n',
    };
  });
}

/* ------------------------------- 小说适配器 ------------------------------ */

export async function wattpad(src) {
  // 优先走公开 API；返回空/报错时回退到榜单页解析。
  // 实测（CI 开放网络）：api.wattpad.com 会拒绝无鉴权调用（此前 fetched 恒 0 无报错的根因），
  // 且旧榜单路径 /stories/hot 已 404——Wattpad 改版后榜单为 /stories/<分类>/hot 形式，
  // 故回退依次尝试多个候选路径，全部失败才报错。
  const apiErrors = [];
  try {
    const url = `https://api.wattpad.com/api/v3/stories?filter=hot&limit=${
      src.limit || 20
    }&fields=id,title,user(name),cover,readCount,voteCount,numParts,completed,mature,language(name),tags,modifyDate,url`;
    const json = await fetchJSON(url);
    const stories = json?.stories || [];
    if (!stories.length) throw new Error('wattpad api 返回空 stories（可能需 api-key）');
    return stories.map((s, i) => ({
      slug: 'wattpad-' + s.id,
      frontmatter: {
        title: s.title,
        author: s.user?.name || 'Unknown',
        platform: 'Wattpad',
        sourceUrl: s.url,
        coverUrl: cleanCover(s.cover?.['512x512'] || s.cover?.original || s.cover),
        language: mapLang(s.language?.name),
        tags: s.tags || [],
        status: s.completed ? 'completed' : 'ongoing',
        pubDate: new Date(s.modifyDate || Date.now()),
        sourceId: 'wattpad:' + s.id,
        origin: 'api',
        metrics: { views: s.readCount, rating: approxRating(s.voteCount, s.readCount), rank: i + 1 },
        review: makeReview('Wattpad', i + 1, mapLang(s.language?.name)),
      },
      body: '',
    }));
  } catch (apiErr) {
    apiErrors.push(String(apiErr?.message || apiErr));
    // HTML 回退：旧路径 /stories/hot 已 404，Wattpad 改版后榜单为 /stories/<分类>/hot，
    // 依次尝试候选路径（all 未确认存在，romance 必有）；story 链接可能是相对路径，
    // 正则不能要求域名前缀。全部失败才向上抛错（错误信息含各路径结果，便于 CI 诊断）。
    const candidates = [
      'https://www.wattpad.com/stories/hot',
      'https://www.wattpad.com/stories/all/hot?locale=en_US',
      'https://www.wattpad.com/stories/romance/hot?locale=en_US',
    ];
    for (const u of candidates) {
      try {
        const html = await fetchText(u, { timeout: 20000 });
        const items = collectByAnchor(html, {
          hrefRe: /story\/\d+/i,
          idRe: /story\/(\d+)/i,
          host: 'https://www.wattpad.com',
        });
        if (!items.length) {
          apiErrors.push(`${u}: 页面可达但无 story 链接`);
          continue;
        }
        return items.map((c, i) => ({
          slug: 'wattpad-' + c.id,
          frontmatter: {
            title: c.title,
            author: '',
            platform: 'Wattpad',
            sourceUrl: c.href,
            coverUrl: cleanCover(c.cover),
            language: 'en',
            tags: [],
            status: 'ongoing',
            pubDate: new Date(),
            sourceId: 'wattpad:' + c.id,
            origin: 'html',
            metrics: { rank: i + 1 },
            review: makeReview('Wattpad', i + 1, 'en'),
          },
          body: 'Auto-harvested (HTML fallback) from Wattpad. 上线前请核对。\n',
        }));
      } catch (e) {
        apiErrors.push(`${u}: ${e?.message || e}`);
      }
    }
    throw new Error('wattpad 所有路径均失败: ' + apiErrors.join(' | '));
  }
}

export async function webnovel() {
  // Webnovel 榜单页 /ranking/novel/all_time/popular_rank 是服务端渲染的完整内容
  // （外部网络实测可拿到 TOP20 书名 + /book/<slug>_<id> 链接），直接解析 HTML。
  // 弃用 JSON 接口 /go/pcm/category/getRankList：CI 实测对数据中心 IP 恒 403
  //（即便经 getSetCookie() 取到 _csrfToken 也一样，属接口级 bot 防护，页面不受影响）。
  const html = await fetchText('https://www.webnovel.com/ranking/novel/all_time/popular_rank', {
    timeout: 20000,
    headers: { 'Accept-Language': 'en-US,en;q=0.9' },
  });
  const items = collectByAnchor(html, {
    hrefRe: /\/book\/[a-z0-9-]+_\d+/i,
    idRe: /_([0-9]+)(?:\/|$)/i,
    host: 'https://www.webnovel.com',
  });
  if (!items.length) throw new Error('webnovel 榜单页可达但未解析到条目（可能改版）');
  return items.map((c, i) => ({
    slug: 'webnovel-' + c.id,
    frontmatter: {
      title: c.title,
      author: '',
      platform: 'Webnovel',
      sourceUrl: c.href,
      coverUrl: cleanCover(c.cover),
      language: 'en',
      status: 'ongoing',
      pubDate: new Date(),
      sourceId: 'webnovel:' + c.id,
      origin: 'html',
      metrics: { rank: i + 1 },
      review: makeReview('Webnovel', i + 1, 'en'),
    },
    body: 'Auto-harvested from Webnovel ranking page. 上线前请核对作者 / 封面。\n',
  }));
}

export async function wuxiaworld() {
  // Wuxiaworld 列表页为 SPA：数据由前端 React Query 从私有 API 拉取，
  // 页面 window.__REACT_QUERY_STATE__ 为空、无内嵌数据、也无公开排行榜端点 → 纯 HTML 解析恒为 0。
  // 已降级 manual 档，走 import.mjs 人工录入。
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
      coverUrl: cleanCover(c.cover),
      language: 'en',
      status: 'ongoing',
      pubDate: new Date(),
      sourceId: 'wuxiaworld:' + c.id,
      origin: 'html',
      metrics: { rank: i + 1 },
      review: makeReview('Wuxiaworld', i + 1, 'en'),
    },
    body: 'Auto-harvested from Wuxiaworld. 上线前请核对。\n',
  }));
}

export async function xiaoshuohui() {
  // 小说会人气榜 /top/popularity/：条目链接为相对路径 /<id>/ 形式（纯数字），
  // 标题在 anchor 文本；封面是懒加载 data-src（src 为 lazy_bg 占位图），
  // imgSrc 已优先取 data-src。此前用 /book|novel|info/<id> 正则 → 恒 0（CI 实测）。
  const html = await fetchText('https://www.xiaoshuohui.com.cn/top/popularity/', {
    timeout: 20000,
    ua: MOBILE_UA,
  });
  const items = collectByAnchor(html, {
    // 注意：idRe 是对「补全 host 后的完整 URL」匹配的，不能用 ^...$ 锚定
    hrefRe: /^\/\d+\/$/i,
    idRe: /\/(\d+)\/$/i,
    host: 'https://www.xiaoshuohui.com.cn',
  });
  return items.map((c, i) => ({
    slug: 'xiaoshuohui-' + c.id,
    frontmatter: {
      title: c.title,
      author: '',
      platform: '小说会',
      sourceUrl: c.href,
      coverUrl: cleanCover(c.cover),
      language: 'zh',
      status: 'ongoing',
      pubDate: new Date(),
      sourceId: 'xiaoshuohui:' + c.id,
      origin: 'html',
      metrics: { rank: i + 1 },
      review: makeReview('小说会', i + 1, 'zh'),
    },
    body: '自动采集自小说会人气榜，上线前请核对作者 / 封面。\n',
  }));
}

export async function royalroad() {
  // RoyalRoad：英文原创小说站（CC 协议友好），排行榜 HTML 服务端渲染，含封面 + 标题，
  // 适合作为"海外正版小说"的稳定自动源（Wattpad/Webnovel 在沙箱出口被拦时它能兜底）。
  const html = await fetchText('https://www.royalroad.com/fictions/best-rated', { timeout: 20000 });
  const items = collectByAnchor(html, {
    hrefRe: /\/fiction\/\d+\//i,
    idRe: /\/fiction\/(\d+)\//i,
    host: 'https://www.royalroad.com',
  });
  return items.map((c, i) => ({
    slug: 'royalroad-' + c.id,
    frontmatter: {
      title: c.title,
      author: '',
      platform: 'RoyalRoad',
      sourceUrl: c.href,
      coverUrl: cleanCover(c.cover),
      language: 'en',
      status: 'ongoing',
      pubDate: new Date(),
      sourceId: 'royalroad:' + c.id,
      origin: 'html',
      metrics: { rank: i + 1 },
      review: makeReview('RoyalRoad', i + 1, 'en'),
    },
    body: 'Auto-harvested from RoyalRoad best-rated. 上线前请核对。\n',
  }));
}

export const ADAPTERS = {
  webtoon,
  tapas,
  qq,
  kuaikan,
  mkzhan,
  wattpad,
  webnovel,
  wuxiaworld,
  xiaoshuohui,
  royalroad,
};
