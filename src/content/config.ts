import { defineCollection, z } from 'astro:content';

/**
 * 正版平台白名单（唯一事实来源）
 * ------------------------------------------------------------------
 * harvest.mjs 与 generate-redirects.mjs 都从这里读取，杜绝收录盗版站。
 * 新增平台必须先在这里登记，否则自动采集会拒绝入库。
 */
export const VIDEO_PLATFORMS = ['抖音', 'TikTok'] as const;
export const COMIC_PLATFORMS = ['Webtoon', 'Tapas', '腾讯动漫', '漫客栈', '快看'] as const;
export const NOVEL_PLATFORMS = ['Webnovel', 'Wattpad', 'Wuxiaworld', '番茄小说'] as const;

/** 内容语种：用于中/英双语站点分流 */
export const LANGUAGES = ['zh', 'en'] as const;

/** 连载状态用语义化 key，展示时由 i18n 翻译 */
export const STATUSES = ['ongoing', 'completed'] as const;

/** 收录来源：manual 人工 / api 接口 / html 榜单页 / csv 批量导入 */
export const ORIGINS = ['manual', 'api', 'html', 'csv'] as const;

/**
 * 热度指标 —— 决定"点击量高 / 评分高 / 增长快"的收录门槛
 * 全部可选：短视频平台通常拿不到结构化数据，允许只填部分字段。
 */
const metricsSchema = z
  .object({
    /** 阅读数 / 播放数 / 人气值（平台各异，仅用于同平台内排序） */
    views: z.number().int().nonnegative().optional(),
    /** 评分，统一折算为 10 分制 */
    rating: z.number().min(0).max(10).optional(),
    /** 近 7 日增长百分比，例如 12.5 表示 +12.5% */
    growth: z.number().optional(),
    /** 榜单名次，1 为第一 */
    rank: z.number().int().positive().optional(),
    /** 订阅数 / 收藏数 */
    subscribers: z.number().int().nonnegative().optional(),
    /** 指标快照时间，用于判断数据新鲜度。JSON 中以字符串存，用 coerce 转 Date */
    capturedAt: z.coerce.date().optional(),
  })
  .optional();

const baseFields = {
  title: z.string(),
  sourceUrl: z.string().url(),
  coverUrl: z.string().url().optional(),
  /** 语种：zh 中文 / en 英文 */
  language: z.enum(LANGUAGES).default('zh'),
  tags: z.array(z.string()).default([]),
  metrics: metricsSchema,
  /** 平台内唯一 ID，供自动采集去重（如 wattpad:123456789） */
  sourceId: z.string().optional(),
  /**
   * 编辑短评：40–120 字的原创点评，渲染在列表页卡片上（详情页不索引，写正文无收益）。
   * 只写源站没有的增量信息 —— 适合谁看 / 看点在何处 / 避雷提示 / 更新是否稳定。
   * 绝不写剧情简介（复制源站 = 重复内容，反而加重薄内容判定）。
   */
  review: z.string().min(10).max(200).optional(),
  /** 收录方式 */
  origin: z.enum(ORIGINS).default('manual'),
  /** JSON 中以 "YYYY-MM-DD" 字符串存，用 coerce 转 Date */
  pubDate: z.coerce.date(),
};

/**
 * 短视频 / 漫画 / 小说条目
 * ------------------------------------------------------------------
 * 2026-09 起改为 `type: 'data'` 的 JSON 数据文件（Astro 4 原生 legacy 数据集合，
 * 自动加载 src/content/<collection>/*.json，无需 loader）：
 *   - 几千条规模下，每文件一 JSON、id = 文件名，Git 友好、diff 清爽；
 *   - 规避了 YAML frontmatter 的冒号/特殊字符转义坑；
 *   - 数据集合条目用 `entry.id`（而非 content 集合的 `entry.slug`）访问。
 * 条目正文（详情页）不索引、只做跳转，故无正文需求，JSON 足够。
 */
const videos = defineCollection({
  type: 'data',
  schema: z.object({
    ...baseFields,
    creator: z.string(),
    platform: z.enum(VIDEO_PLATFORMS),
  }),
});

/** 漫画条目 */
const comics = defineCollection({
  type: 'data',
  schema: z.object({
    ...baseFields,
    author: z.string(),
    platform: z.enum(COMIC_PLATFORMS),
    status: z.enum(STATUSES).default('ongoing'),
  }),
});

/** 小说条目 */
const novels = defineCollection({
  type: 'data',
  schema: z.object({
    ...baseFields,
    author: z.string(),
    platform: z.enum(NOVEL_PLATFORMS),
    status: z.enum(STATUSES).default('ongoing'),
  }),
});

/**
 * 专题 / 合集（Editorial）
 * ------------------------------------------------------------------
 * 可索引的长文页：每篇是一篇原创赏析，引用若干条目。
 * 这是抗「薄内容」的主力 —— 详情页是不索引的跳转页，
 * 所以有观点的原创长文只能落在专题页上。
 * 因含长文正文，保留 `type: 'content'` 的 Markdown。
 */
const editorial = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    language: z.enum(LANGUAGES).default('zh'),
    /** 关联的内容分类，决定引用条目在哪个集合内查找 */
    type: z.enum(['videos', 'comics', 'novels']),
    /** 引用的条目 id（在 type 集合内查找），按推荐顺序排列 */
    entries: z.array(z.string()).default([]),
    author: z.string().default('HubLinks 编辑部'),
    tags: z.array(z.string()).default([]),
    pubDate: z.date(),
    updatedDate: z.date().optional(),
  }),
});

export const collections = { videos, comics, novels, editorial };
