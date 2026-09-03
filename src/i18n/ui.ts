/**
 * 中 / 英双语文案字典
 * ------------------------------------------------------------------
 * 默认语言为中文（根路径 `/`），英文走 `/en/` 前缀。
 * 新增文案时请同时补齐 zh 与 en，缺失会回退到中文。
 */

export const languages = {
  zh: '中文',
  en: 'English',
} as const;

export type Lang = keyof typeof languages;

export const defaultLang: Lang = 'zh';

export const ui = {
  zh: {
    'site.name': 'HubLinks',
    'site.tagline': '发现值得一看的优质内容',

    'nav.videos': '短视频',
    'nav.comics': '漫画',
    'nav.novels': '小说',
    'nav.about': '关于',
    'nav.search': '搜索',
    'nav.searchPlaceholder': '搜索内容…',
    'nav.editorial': '专题',
    'nav.editorialPolicy': '收录标准',

    'hero.badge': '纯链接索引 · 零媒体存储',
    'hero.title': '发现值得一看的优质内容',
    'hero.desc': '我们精选短视频、漫画与小说，只做链接索引——点击即跳转原站，内容版权归原作者与平台所有。',
    'hero.ctaBrowse': '开始浏览',
    'hero.ctaAbout': '了解本站',

    'stat.videos': '短视频',
    'stat.comics': '漫画',
    'stat.novels': '小说',
    'stat.total': '全部条目',

    'section.latestVideos': '热门短视频',
    'section.latestComics': '人气漫画',
    'section.latestNovels': '热门小说',
    'section.viewAll': '查看全部 →',
    'section.videosSub': '抖音 · TikTok',
    'section.comicsSub': 'Webtoon · Tapas · 腾讯动漫 · 快看',
    'section.novelsSub': 'Webnovel · Wattpad · Wuxiaworld · 番茄小说',

    'filter.all': '全部',
    'filter.lang': '语种',
    'filter.sort': '排序',
    'sort.latest': '最新收录',
    'sort.hot': '最热',
    'sort.rating': '最高评分',
    'sort.growth': '增长最快',

    'status.ongoing': '连载中',
    'status.completed': '已完结',

    'metric.views': '阅读',
    'metric.subscribers': '订阅',
    'metric.rating': '评分',
    'metric.growth': '7 日增长',
    'metric.rank': '榜单第',
    'metric.rankSuffix': '名',

    'list.countPrefix': '共',
    'list.countSuffix': '部 · 点击卡片将跳转到原站，本站不存储任何内容。',

    'editorial.title': '专题推荐',
    'editorial.subtitle': '编辑原创的长文赏析与精选合集，每篇都围绕一个明确的选片角度展开。',
    'editorial.empty': '暂无专题，敬请期待。',
    'editorial.related': '相关专题',
    'editorial.included': '本专题收录',
    'editorial.entriesHint': '以下条目按推荐顺序排列，点击卡片直达正版平台原站。',
    'editorial.backToList': '← 返回专题列表',
    'editorial.all': '查看全部专题',
    'editorial.published': '发布于',
    'editorial.updated': '最后更新',

    'home.fresh': '本周新增',
    'home.freshSub': '最近 7 天新收录的条目',

    'metric.updatedAt': '数据更新于',
    'list.browseByPlatform': '按平台浏览',
    'list.platformIntro':
      '仅收录来自 {platform} 的正版{type}，点击卡片直达原站，本站不存储任何内容。',
    'list.relatedEditorial': '相关专题推荐',

    'picks.title': '编辑精选',
    'picks.subtitle': '基于各平台公开热度数据，编辑逐条写过推荐语',
    'picks.methodology':
      '排序依据各平台公开的评分、近 7 日增长与榜单名次综合计算；只展示编辑写过一句话推荐的条目。所有链接直达正版原站。',

    'pagination.prev': '上一页',
    'pagination.next': '下一页',
    'pagination.page': '第 {page} 页',
    'pagination.pageOf': '第 {page} / {total} 页',

    'search.title': '搜索',
    'search.placeholder': '输入关键词搜索…',
    'search.hint': '输入关键词开始搜索，结果实时更新。',
    'search.empty': '暂无匹配结果。',
    'search.searching': '搜索中…',

    'redirect.title': '正在跳转',
    'redirect.desc': '即将带你前往原站：',
    'redirect.manual': '如果没有自动跳转，请点击下面的链接。',
    'redirect.target': '前往原站',
    'redirect.notice': '本站仅提供链接索引，不托管任何内容。',

    'footer.about': '内容发现与导流站。本站仅为链接索引服务，不存储、不托管任何媒体内容。',
    'footer.browse': '浏览',
    'footer.site': '关于本站',
    'footer.aboutUs': '关于我们',
    'footer.disclaimer': '免责声明',
    'footer.privacy': '隐私政策',
    'footer.dmca': 'DMCA',
    'footer.affiliate': '联盟披露',
    'footer.affiliateDesc': '本站部分链接为联盟营销链接。点击并完成购买，我们可能获得少量佣金，这不会增加你的任何费用。',
    'footer.rights': '本站仅收录正版平台内容，不提供任何媒体托管。',

    'notfound.title': '页面不存在',
    'notfound.desc': '你访问的页面可能已被移除或链接有误。',
    'notfound.home': '返回首页',

    'language.switch': 'English',
  },

  en: {
    'site.name': 'HubLinks',
    'site.tagline': 'Discover content worth your time',

    'nav.videos': 'Short videos',
    'nav.comics': 'Comics',
    'nav.novels': 'Novels',
    'nav.about': 'About',
    'nav.search': 'Search',
    'nav.searchPlaceholder': 'Search content…',
    'nav.editorial': 'Editorial',
    'nav.editorialPolicy': 'Editorial policy',

    'hero.badge': 'Link index only · zero media hosting',
    'hero.title': 'Discover content worth your time',
    'hero.desc': 'Hand-picked short videos, comics and novels. We index links only — one click takes you to the official source.',
    'hero.ctaBrowse': 'Start browsing',
    'hero.ctaAbout': 'About us',

    'stat.videos': 'Videos',
    'stat.comics': 'Comics',
    'stat.novels': 'Novels',
    'stat.total': 'Total entries',

    'section.latestVideos': 'Trending short videos',
    'section.latestComics': 'Popular comics',
    'section.latestNovels': 'Popular novels',
    'section.viewAll': 'View all →',
    'section.videosSub': 'Douyin · TikTok',
    'section.comicsSub': 'Webtoon · Tapas · Tencent Comic · Kuaikan',
    'section.novelsSub': 'Webnovel · Wattpad · Wuxiaworld · Fanqie Novel',

    'filter.all': 'All',
    'filter.lang': 'Language',
    'filter.sort': 'Sort',
    'sort.latest': 'Newest',
    'sort.hot': 'Most viewed',
    'sort.rating': 'Top rated',
    'sort.growth': 'Fastest growing',

    'status.ongoing': 'Ongoing',
    'status.completed': 'Completed',

    'metric.views': 'views',
    'metric.subscribers': 'subs',
    'metric.rating': 'Rating',
    'metric.growth': '7d growth',
    'metric.rank': 'Rank #',
    'metric.rankSuffix': '',

    'list.countPrefix': '',
    'list.countSuffix': 'titles · Click a card to open the official source. Nothing is hosted here.',

    'editorial.title': 'Editorial',
    'editorial.subtitle': 'Original long-form picks and curated collections, each built around a clear angle.',
    'editorial.empty': 'No editorial yet — check back soon.',
    'editorial.related': 'Related reading',
    'editorial.included': 'In this collection',
    'editorial.entriesHint': 'Listed in recommended order. Every card opens the official platform.',
    'editorial.backToList': '← All editorial',
    'editorial.all': 'View all editorial',
    'editorial.published': 'Published',
    'editorial.updated': 'Last updated',

    'picks.title': "Editor's Picks",
    'picks.subtitle': 'Ranked by each platform’s public metrics, with a hand-written note from our editors',
    'picks.methodology':
      'Ranking blends each platform’s public rating, 7-day growth and chart position. Only titles our editors have written a one-line note for are shown. Every link goes straight to the official source.',

    'home.fresh': 'Fresh this week',
    'home.freshSub': 'Added in the last 7 days',

    'metric.updatedAt': 'Data updated',
    'list.browseByPlatform': 'Browse by platform',
    'list.platformIntro':
      'Only {type} from {platform}. Every card opens the official source — nothing is hosted here.',
    'list.relatedEditorial': 'Related editorial',

    'pagination.prev': 'Previous',
    'pagination.next': 'Next',
    'pagination.page': 'Page {page}',
    'pagination.pageOf': 'Page {page} of {total}',

    'search.title': 'Search',
    'search.placeholder': 'Type to search…',
    'search.hint': 'Start typing — results update as you go.',
    'search.empty': 'No matches yet.',
    'search.searching': 'Searching…',

    'redirect.title': 'Redirecting',
    'redirect.desc': 'Taking you to the official source:',
    'redirect.manual': 'If nothing happens, use the link below.',
    'redirect.target': 'Continue to source',
    'redirect.notice': 'This site indexes links only and hosts no content.',

    'footer.about': 'A content discovery hub. We are a link index service — no media is stored or hosted on this site.',
    'footer.browse': 'Browse',
    'footer.site': 'About this site',
    'footer.aboutUs': 'About us',
    'footer.disclaimer': 'Disclaimer',
    'footer.privacy': 'Privacy policy',
    'footer.dmca': 'DMCA',
    'footer.affiliate': 'Affiliate disclosure',
    'footer.affiliateDesc': 'Some links on this site are affiliate links. If you buy through them we may earn a small commission at no extra cost to you.',
    'footer.rights': 'We index official platforms only and host no media.',

    'notfound.title': 'Page not found',
    'notfound.desc': 'This page may have been removed, or the link is wrong.',
    'notfound.home': 'Back to home',

    'language.switch': '中文',
  },
} as const;

/** 平台名在英文站下的本地化显示（品牌名本身不翻译，但中文站名有官方英文名） */
export const platformNames: Record<string, Record<Lang, string>> = {
  抖音: { zh: '抖音', en: 'Douyin' },
  TikTok: { zh: 'TikTok', en: 'TikTok' },
  Webtoon: { zh: 'Webtoon', en: 'Webtoon' },
  Tapas: { zh: 'Tapas', en: 'Tapas' },
  腾讯动漫: { zh: '腾讯动漫', en: 'Tencent Comic' },
  漫客栈: { zh: '漫客栈', en: 'Man Ke Zhan' },
  快看: { zh: '快看', en: 'Kuaikan' },
  Webnovel: { zh: 'Webnovel', en: 'Webnovel' },
  Wattpad: { zh: 'Wattpad', en: 'Wattpad' },
  Wuxiaworld: { zh: 'Wuxiaworld', en: 'Wuxiaworld' },
  番茄小说: { zh: '番茄小说', en: 'Fanqie Novel' },
};

/**
 * 平台 → URL slug
 * 中文平台名无法直接进 URL，这里给出稳定的 ASCII slug。
 * 用途：生成 /comics/platform/<slug>/ 这类「静态化筛选页」——
 * 前端 JS 筛选爬虫看不到，静态页才能被索引。
 */
export const platformSlugs: Record<string, string> = {
  抖音: 'douyin',
  TikTok: 'tiktok',
  Webtoon: 'webtoon',
  Tapas: 'tapas',
  腾讯动漫: 'tencent-comic',
  漫客栈: 'mankezhan',
  快看: 'kuaikan',
  Webnovel: 'webnovel',
  Wattpad: 'wattpad',
  Wuxiaworld: 'wuxiaworld',
  番茄小说: 'fanqie',
};

/** 平台名 → slug（未知平台降级为小写连字符形式） */
export function platformSlug(platform: string): string {
  return platformSlugs[platform] ?? platform.toLowerCase().replace(/\s+/g, '-');
}

/** slug → 平台名（未登记返回 undefined） */
export function platformFromSlug(slug: string): string | undefined {
  return Object.keys(platformSlugs).find((p) => platformSlugs[p] === slug);
}

type UiKey = keyof (typeof ui)['zh'];

/** 从 URL 推断语言：/en/ 开头为英文，其余为中文 */
export function getLangFromUrl(url: URL): Lang {
  const [, firstSegment] = url.pathname.split('/');
  return firstSegment === 'en' ? 'en' : defaultLang;
}

/** 生成翻译函数，缺 key 时回退中文 */
export function useTranslations(lang: Lang) {
  return function t(key: UiKey): string {
    const dict = ui[lang] as Record<string, string>;
    const fallback = ui[defaultLang] as Record<string, string>;
    return dict[key] ?? fallback[key] ?? key;
  };
}

/** 生成本地化路径：中文保持原样，英文加 /en 前缀 */
export function localizedPath(path: string, lang: Lang): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (lang === defaultLang) return clean === '/' ? '/' : clean;
  return clean === '/' ? `/${lang}/` : `/${lang}${clean}`;
}

/** 生成语言切换目标路径（保持当前页面，仅换前缀） */
export function switchLanguagePath(pathname: string, to: Lang): string {
  const isEn = pathname === '/en' || pathname.startsWith('/en/');
  let bare = isEn ? pathname.slice(3) : pathname;
  if (bare === '' || bare === '/') bare = '/';
  return localizedPath(bare, to);
}

/** 平台名本地化 */
export function platformName(platform: string, lang: Lang): string {
  return platformNames[platform]?.[lang] ?? platform;
}

/** 状态本地化 */
export function statusName(status: string, lang: Lang): string {
  if (status === 'ongoing') return lang === 'en' ? 'Ongoing' : '连载中';
  if (status === 'completed') return lang === 'en' ? 'Completed' : '已完结';
  return status;
}

/** 大数字格式化：12345 → 12.3k / 1234567 → 1.2M */
export function formatCount(n: number, lang: Lang): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const v = n / 1000;
    return `${v.toFixed(v < 10 ? 1 : 0)}k`;
  }
  const v = n / 1_000_000;
  return `${v.toFixed(v < 10 ? 1 : 0)}M`;
}
