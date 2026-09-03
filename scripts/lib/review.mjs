// 审核/下架的判定逻辑 —— 采集系统的安全层。
//
// 1) isConfidentForAutoPromote(frontmatter)
//    自动审核（置信门控）：只有"真来自适配器、字段齐全、主机命中白名单"的条目
//    才允许免人工晋升。其余一律留 pending 人工复核，绝不无脑全过。
//
// 2) classifyLiveness({ status, body })
//    下架判定：回抓已上线条目的源站后，判断该内容是否还在。
//    - 'dead'       → 应下架移除（404/410，或页面明确"已下架/已删除"）
//    - 'ambiguous'  → 无法判定（403/429/超时/网络错）→ 跳过，不删，避免误杀
//    - 'alive'      → 正常，保留

import { isWhitelistedHost } from './sources.mjs';

/**
 * 自动审核置信门控。
 * 关键：只放行"机器可验证"的条目；任何需要人眼判断正版/封面/作者的，都留人工。
 */
export function isConfidentForAutoPromote(fm) {
  if (!fm || typeof fm !== 'object') return false;

  // 只接受真来自适配器的采集（api/html）；manual/csv 留给人工，避免把半自动
  // 录入里可能的笔误也自动放行。
  if (!['api', 'html'].includes(fm.origin)) return false;

  // 必填字段齐全
  if (!fm.title || !fm.sourceUrl || !fm.platform) return false;

  // 必须带平台内唯一 ID —— 这是"确由适配器产出"的强信号（手动乱填很难对齐）。
  if (!fm.sourceId) return false;

  // metrics 非空 —— 证明它确实从真实榜单/接口拿到了热度数据，而非空壳。
  if (!fm.metrics || Object.keys(fm.metrics).length === 0) return false;

  // 主机必须命中该平台白名单（版权安全核心）。
  if (!isWhitelistedHost(fm.platform, fm.sourceUrl)) return false;

  return true;
}

// 页面文案中的"已下架/已删除"信号（保守匹配，仅在 HTTP 200 时启用）。
// 仅作 404/410 之外的补充，误报风险低；遇 403/429 等根本不进此分支。
const REMOVAL_MARKERS = [
  // 英文平台通用
  /\b(this (content|story|series|book|chapter|title) (has been |was )?(removed|deleted|taken down|unavailable|hidden|privated))\b/i,
  /\b(content (removed|deleted|unavailable|not available|taken down))\b/i,
  /\b(the (story|series|book) (is |was )?(no longer available|removed|deleted))\b/i,
  /\b(sorry, this (page|content) (is |was )?(unavailable|not found|removed))\b/i,
  // 中文平台通用
  /该(作品|漫画|小说|章节|内容)(已)?(被)?下架/,
  /(作品|漫画|小说|章节)(已)?(被)?删除/,
  /该(内容|页面)已?不存在/,
  /(内容|作品)(已)?失效/,
  /(因|由于).{0,12}(版权|违规).{0,8}(下架|删除|移除)/,
];

/**
 * 下架判定。
 * @param {{status:number, body?:string}} param0
 * @returns {'dead'|'alive'|'ambiguous'}
 */
export function classifyLiveness({ status, body = '' }) {
  // 明确的"不存在"信号
  if (status === 404 || status === 410) return 'dead';

  // 成功响应：检查文案是否表明已下架
  if (status === 200 || status === 304) {
    if (REMOVAL_MARKERS.some((re) => re.test(body))) return 'dead';
    return 'alive';
  }

  // 其余（403 反爬 / 429 限流 / 5xx / 网络错 / 超时 / 0）一律视为无法判定，
  // 宁可放过，绝不误删。
  return 'ambiguous';
}

/**
 * 编辑精选准入校验：有热度指标（metrics 非空）却没写 review 的条目，
 * 无法进入「编辑精选」板块（见 content.ts 的 pickEditorPicks），等于白采了热度数据。
 * 同时校验 review 字数是否在 10–200 区间（与 config.ts 的 zod 一致）。
 * @param {Array<{data?:object}>|Array<object>} entries Astro entry（{data}）或扁平 JSON 对象均可
 * @returns {string[]} 告警数组（为空表示全部合规）
 */
export function lintReviews(entries) {
  const warnings = [];
  for (const raw of entries) {
    const fm = raw?.data ?? raw; // 兼容 Astro entry 与扁平 JSON
    if (!fm || typeof fm !== 'object') continue;
    const hasMetrics = fm.metrics && Object.keys(fm.metrics).length > 0;
    const review = typeof fm.review === 'string' ? fm.review.trim() : '';
    const hasReview = review.length > 0;
    if (hasMetrics && !hasReview) {
      warnings.push(`⚠ ${fm.title ?? fm.id ?? '(untitled)'} 有热度指标但缺 review，无法进入编辑精选`);
    }
    if (hasReview && (review.length < 10 || review.length > 200)) {
      warnings.push(`⚠ ${fm.title ?? fm.id ?? '(untitled)'} review 字数 ${review.length} 不在 10–200 区间`);
    }
  }
  return warnings;
}
