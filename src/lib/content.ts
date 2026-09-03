import type { CollectionEntry } from 'astro:content';
import { platformSlug, formatCount, type Lang } from '../i18n/ui.ts';

export type AnyEntry = CollectionEntry<'videos' | 'comics' | 'novels'>;
export type SortKey = 'latest' | 'hot' | 'rating' | 'growth';

type Metrics = {
  views?: number;
  rating?: number;
  growth?: number;
  rank?: number;
  subscribers?: number;
  /** 指标快照时间，用于前端展示「数据更新于」，作为 freshness 信号 */
  capturedAt?: Date;
};

function m(entry: AnyEntry): Metrics {
  return (entry.data as { metrics?: Metrics }).metrics ?? {};
}

/** 按语种过滤：中文站只出 zh 条目，英文站只出 en 条目 */
export function byLang<T extends AnyEntry>(entries: T[], lang: Lang): T[] {
  return entries.filter((e) => (e.data.language ?? 'zh') === lang);
}

/**
 * 热度排序
 * 缺失指标的条目统一沉到末尾，避免"没数据"的内容占据榜首。
 */
export function sortEntries<T extends AnyEntry>(entries: T[], sort: SortKey = 'latest'): T[] {
  const missing = Number.NEGATIVE_INFINITY;
  return [...entries].sort((a, b) => {
    switch (sort) {
      case 'hot': {
        const av = m(a).views ?? m(a).subscribers ?? missing;
        const bv = m(b).views ?? m(b).subscribers ?? missing;
        return bv - av;
      }
      case 'rating': {
        const ar = m(a).rating ?? missing;
        const br = m(b).rating ?? missing;
        return br - ar;
      }
      case 'growth': {
        const ag = m(a).growth ?? missing;
        const bg = m(b).growth ?? missing;
        return bg - ag;
      }
      case 'latest':
      default:
        return b.data.pubDate.valueOf() - a.data.pubDate.valueOf();
    }
  });
}

/**
 * 列表页每页条目数。
 * 控制单页规模：一页塞几百条对爬虫就是「纯目录」，分页后每页主题更集中，
 * 也让每个分页 URL 成为独立的可索引入口。
 */
export const PAGE_SIZE = 24;

/**
 * 平台筛选页的 URL 基址（静态化筛选，爬虫可见）
 * /comics/            → 全部平台
 * /comics/platform/webtoon/
 * /comics/page/2/
 * /comics/platform/webtoon/page/2/
 */
export function listBasePath(
  lang: Lang,
  type: string,
  platform?: string
): string {
  const prefix = lang === 'en' ? '/en/' : '/';
  const slug = platform ? platformSlug(platform) : '';
  return slug ? `${prefix}${type}/platform/${slug}/` : `${prefix}${type}/`;
}

/** 条目是否带有可展示的热度指标 */
export function hasMetrics(entry: AnyEntry): boolean {
  const mm = m(entry);
  return mm.views != null || mm.rating != null || mm.growth != null || mm.rank != null;
}

export function metricsOf(entry: AnyEntry): Metrics {
  return m(entry);
}

/** 格式化为 YYYY-MM-DD（接受 Date 或可解析字符串） */
export function fmtDate(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return dt.toISOString().slice(0, 10);
}

/**
 * 源平台热度综合分（「编辑精选」排序用）
 * 直接复用 harvest 录入的源平台 metrics（评分 / 增长 / 播放 / 订阅 / 榜单名次），
 * 不依赖本站点击。缺失指标以发布新鲜度兜底，保证空 metrics 条目也能稳定排序。
 */
export function hotScore(entry: AnyEntry): number {
  const mm = (entry.data as { metrics?: Metrics }).metrics;
  let s = 0;
  if (mm?.rating != null) s += mm.rating * 6; // 最高 ~60
  if (mm?.growth != null) s += Math.max(0, Math.min(mm.growth, 100)) * 0.3; // 最高 ~30
  if (mm?.views != null) s += Math.log10(Math.max(10, mm.views)) * 3; // ~3–15
  if (mm?.subscribers != null) s += Math.log10(Math.max(10, mm.subscribers)) * 2;
  if (mm?.rank != null) s += Math.max(0, 50 - mm.rank) * 0.5; // 第 1 名 ~+24.5
  const ageDays = (Date.now() - new Date(entry.data.pubDate).getTime()) / 86400000;
  s += Math.max(0, 30 - ageDays) * 0.3; // 新鲜度兜底
  return s;
}

/**
 * 编辑精选：按源平台热度分排序，且**只收录「编辑写过一句话推荐（review）」的条目**。
 * requireReview 默认 true —— 这是「源平台指标 + 人工文案」的硬性门槛：
 * 没写人工推荐的条目，再热也不进精选，避免自动生成的薄内容。
 */
export function pickEditorPicks<T extends AnyEntry>(
  entries: T[],
  opts: { limit?: number; requireReview?: boolean } = {}
): T[] {
  const { limit = 5, requireReview = true } = opts;
  const pool = requireReview
    ? entries.filter((e) => (e.data as { review?: string }).review)
    : entries;
  return [...pool].sort((a, b) => hotScore(b) - hotScore(a)).slice(0, limit);
}

/** 指标速览文案（由 metrics 派生，作精选块的次要展示行） */
export function metricLine(entry: AnyEntry, lang: Lang): string {
  const mm = (entry.data as { metrics?: Metrics }).metrics;
  if (!mm) return '';
  const parts: string[] = [];
  if (mm.rating != null) parts.push(lang === 'en' ? `★ ${mm.rating}/10` : `评分 ${mm.rating}/10`);
  if (mm.growth != null) parts.push(lang === 'en' ? `+${mm.growth}% 7d` : `7日 +${mm.growth}%`);
  if (mm.views != null)
    parts.push(
      lang === 'en'
        ? `${formatCount(mm.views, lang)} views`
        : `${formatCount(mm.views, lang)} 播放`
    );
  if (mm.subscribers != null)
    parts.push(
      lang === 'en'
        ? `${formatCount(mm.subscribers, lang)} subs`
        : `${formatCount(mm.subscribers, lang)} 订阅`
    );
  if (mm.rank != null) parts.push(lang === 'en' ? `Chart #${mm.rank}` : `榜单 #${mm.rank}`);
  return parts.join(lang === 'en' ? ' · ' : ' · ');
}
