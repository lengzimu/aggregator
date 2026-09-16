// 平台注册表 —— 采集层唯一事实来源。
// 1) hosts 白名单：sourceUrl 的主机必须命中，否则拒绝入库（版权安全，只收正版）。
// 2) tier：api=接口直采 / html=榜单页解析 / manual=反爬强或 SPA，走 import.mjs 半自动录入。
// 3) threshold：实现"点击量高 / 评分高 / 增长快"的收录门槛（满足其一即可）。
//
// 档位判定以实测为准（非假设）：
//   · html 稳定出数（榜单页可解析；封面按需进详情页取）：webtoon / qq(腾讯动漫) / mkzhan(漫客栈) / kuaikan(快看,封面为JS注入留空)
//   · html 海外小说：royalroad(英文原创,含封面)
//   · api 直采：wattpad(公开 API,空 stories 时回退 HTML) / webnovel(排行榜 JSON 接口,需 set-cookie 里的 _csrfToken)
//   · html：xiaoshuohui(小说会 /top/popularity/，条目为 /<id>/ 相对链接)
//   · 已移除：qidian(起点) —— 强反爬恒 0，按用户要求取消自动采集
//   · manual（纯 HTML 解析恒为 0 或反爬强）：tapas / wuxiaworld(均为 SPA) / fanqie(番茄) → 走 import.mjs

export const SOURCES = [
  {
    key: 'webtoon', platform: 'Webtoon', collection: 'comics',
    tier: 'html', adapter: 'webtoon', language: 'en', limit: 20,
    hosts: ['webtoons.com'],
    threshold: { maxRank: 20, minRating: 8.5, minViews: 1_000_000 },
    note: 'Webtoon 公开榜单页可解析（标题需清洗排名前缀噪声）；取 TOP20，或评分≥8.5，或订阅≥百万',
  },
  {
    key: 'tapas', platform: 'Tapas', collection: 'comics',
    tier: 'manual', adapter: null, language: 'en',
    hosts: ['tapas.io'],
    threshold: { maxRank: 20 },
    note: 'Tapas 榜单为 SPA，数据由前端私有 API 拉取，纯 HTML 解析恒为 0；降级 manual，走 import.mjs 人工录入',
  },
  {
    key: 'qq', platform: '腾讯动漫', collection: 'comics',
    tier: 'html', adapter: 'qq', language: 'zh', limit: 20,
    hosts: ['ac.qq.com', 'qq.com'],
    threshold: { maxRank: 30 },
    note: '腾讯动漫排行榜（ac.qq.com/Rank/comicRank）；标题干净，封面需进 Comic/comicInfo/id/<id> 详情页取 manhua.acimg.cn',
  },
  {
    key: 'kuaikan', platform: '快看', collection: 'comics',
    tier: 'html', adapter: 'kuaikan', language: 'zh', limit: 20,
    hosts: ['kuaikanmanhua.com'],
    threshold: { maxRank: 30 },
    note: '快看排行榜 /ranking/9（Nuxt 渲染）：标题在 anchor 文本、需清洗噪声；封面为鉴权 XHR 注入，公开渠道取不到，留空人工补',
  },
  {
    key: 'mkzhan', platform: '漫客栈', collection: 'comics',
    tier: 'html', adapter: 'mkzhan', language: 'zh', limit: 20,
    hosts: ['mkzhan.com', 'm.mkzhan.com'],
    threshold: { maxRank: 30 },
    note: '漫客栈人气榜 /top/popularity/：链接 /<id>/ 形式，标题在 anchor 文本；封面需进 /<id>/ 详情页取 oss.mkzcdn.com',
  },
  {
    key: 'wattpad', platform: 'Wattpad', collection: 'novels',
    tier: 'api', adapter: 'wattpad', language: 'en', limit: 20,
    hosts: ['wattpad.com'],
    threshold: { minViews: 100_000, minRating: 8.0 },
    note: 'Wattpad 公开 API（api.wattpad.com/v3），空 stories 视为失败回退 HTML 解析；沙箱出口拦，CI 验证',
  },
  {
    key: 'webnovel', platform: 'Webnovel', collection: 'novels',
    tier: 'api', adapter: 'webnovel', language: 'en', limit: 20,
    hosts: ['webnovel.com'],
    threshold: { maxRank: 30 },
    note: 'Webnovel 排行榜 JSON 接口 /go/pcm/category/getRankList；_csrfToken 必须经 headers.getSetCookie() 从页面 set-cookie 取',
  },
  {
    key: 'royalroad', platform: 'RoyalRoad', collection: 'novels',
    tier: 'html', adapter: 'royalroad', language: 'en', limit: 20,
    hosts: ['royalroad.com'],
    threshold: { maxRank: 30 },
    note: 'RoyalRoad 英文原创小说 best-rated 榜，HTML 含封面+标题，稳定可解析，作海外小说兜底源',
  },
  {
    key: 'wuxiaworld', platform: 'Wuxiaworld', collection: 'novels',
    tier: 'manual', adapter: null, language: 'en',
    hosts: ['wuxiaworld.com'],
    threshold: { maxRank: 30 },
    note: 'Wuxiaworld 列表页为 SPA，前端私有 API 拉取、页面无内嵌数据，纯 HTML 解析恒为 0；降级 manual',
  },
  {
    key: 'fanqie', platform: '番茄小说', collection: 'novels',
    tier: 'manual', adapter: null, language: 'zh',
    hosts: ['fanqienovel.com', 'fanqie.tv'],
    note: '番茄反爬（字体加密），走 import.mjs 半自动录入',
  },
  {
    key: 'xiaoshuohui', platform: '小说会', collection: 'novels',
    tier: 'html', adapter: 'xiaoshuohui', language: 'zh', limit: 20,
    hosts: ['xiaoshuohui.com.cn', 'www.xiaoshuohui.com.cn'],
    threshold: { maxRank: 30 },
    note: '小说会人气榜（xiaoshuohui.com.cn/top/popularity/）；条目为 /<id>/ 相对链接，封面在 data-src',
  },
];

export function getSource(platform) {
  return SOURCES.find((s) => s.platform === platform);
}

/** 校验某 URL 是否落在指定平台的白名单主机内 */
export function isWhitelistedHost(platform, url) {
  const src = getSource(platform);
  if (!src) return false;
  let host = '';
  try {
    host = new URL(url).host.replace(/^www\./, '');
  } catch {
    return false;
  }
  return src.hosts.some((h) => host === h || host.endsWith('.' + h));
}
