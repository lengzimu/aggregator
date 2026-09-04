// 平台注册表 —— 采集层唯一事实来源。
// 1) hosts 白名单：sourceUrl 的主机必须命中，否则拒绝入库（版权安全，只收正版）。
// 2) tier：api=接口直采 / html=榜单页解析 / manual=反爬强或 SPA，走 import.mjs 半自动录入。
// 3) threshold：实现"点击量高 / 评分高 / 增长快"的收录门槛（满足其一即可）。
//
// 档位判定以实测为准（非假设）：
//   · html 能稳定出数（标题/封面干净）：webtoon / qq(腾讯动漫)
//   · api 直采：wattpad(公开 API) / webnovel(排行榜 JSON 接口，待 CI 验证)
//   · html 但实质 SPA/SSR 壳（纯 HTML 解析恒为垃圾或 0）：kuaikan(快看, Nuxt 壳占位) /
//     tapas / wuxiaworld → 与 mankezhan(漫客栈) / fanqie(番茄) 同列 manual，走 import.mjs
//   · html 待定：qidian(起点) / xiaoshuohui(小说会) 强反爬，CI 若恒 0 则降级 manual

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
    note: '腾讯动漫排行榜（ac.qq.com/Rank/comicRank），桌面 UA，标题干净',
  },
  {
    key: 'kuaikan', platform: '快看', collection: 'comics',
    tier: 'manual', adapter: null, language: 'zh',
    hosts: ['kuaikanmanhua.com'],
    threshold: { maxRank: 30 },
    note: '快看榜单为 Nuxt SSR 壳：/topic/ 链接存在但标题/封面由前端 JS 注入，纯 HTML 取到占位("blank"+data:图)；降级 manual',
  },
  {
    key: 'mankezhan', platform: '漫客栈', collection: 'comics',
    tier: 'manual', adapter: null, language: 'zh',
    hosts: ['mkzhan.com', 'm.mkzhan.com'],
    note: '漫客栈反爬较强，走 import.mjs 半自动录入',
  },
  {
    key: 'wattpad', platform: 'Wattpad', collection: 'novels',
    tier: 'api', adapter: 'wattpad', language: 'en', limit: 20,
    hosts: ['wattpad.com'],
    threshold: { minViews: 100_000, minRating: 8.0 },
    note: 'Wattpad 公开 API（api.wattpad.com/v3）；HTML 回退。沙箱出口拦，CI 开放网络应正常',
  },
  {
    key: 'webnovel', platform: 'Webnovel', collection: 'novels',
    tier: 'api', adapter: 'webnovel', language: 'en', limit: 20,
    hosts: ['webnovel.com'],
    threshold: { maxRank: 30 },
    note: 'Webnovel 排行榜 JSON 接口 /go/pcm/category/getRankList（需 _csrfToken）；待 CI 验证',
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
    key: 'qidian', platform: '起点', collection: 'novels',
    tier: 'html', adapter: 'qidian', language: 'zh', limit: 20,
    hosts: ['qidian.com', 'www.qidian.com', 'book.qidian.com'],
    threshold: { maxRank: 30 },
    note: '起点排行榜（qidian.com/rank）；强反爬，可能需 API/移动端，待 CI 验证；若恒 0 则降级 manual',
  },
  {
    key: 'xiaoshuohui', platform: '小说会', collection: 'novels',
    tier: 'html', adapter: 'xiaoshuohui', language: 'zh', limit: 20,
    hosts: ['xiaoshuohui.com.cn', 'www.xiaoshuohui.com.cn'],
    threshold: { maxRank: 30 },
    note: '小说会排行榜（xiaoshuohui.com.cn/top）；待 CI 验证解析；若恒 0 则降级 manual',
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
