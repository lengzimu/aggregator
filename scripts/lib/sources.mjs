// 平台注册表 —— 采集层唯一事实来源。
// 1) hosts 白名单：sourceUrl 的主机必须命中，否则拒绝入库（版权安全，只收正版）。
// 2) tier：api=接口直采 / html=榜单页解析 / manual=反爬强，走 import.mjs 半自动录入。
// 3) threshold：实现"点击量高 / 评分高 / 增长快"的收录门槛（满足其一即可）。

export const SOURCES = [
  {
    key: 'webtoon', platform: 'Webtoon', collection: 'comics',
    tier: 'html', adapter: 'webtoon', language: 'en', limit: 20,
    hosts: ['webtoons.com'],
    threshold: { maxRank: 20, minRating: 8.5, minViews: 1_000_000 },
    note: 'Webtoon 公开榜单页可解析；取 TOP20，或评分≥8.5，或订阅≥百万',
  },
  {
    key: 'tapas', platform: 'Tapas', collection: 'comics',
    tier: 'html', adapter: 'tapas', language: 'en', limit: 20,
    hosts: ['tapas.io'],
    threshold: { maxRank: 20 },
    note: 'Tapas TOP 榜单页解析',
  },
  {
    key: 'qq', platform: '腾讯动漫', collection: 'comics',
    tier: 'html', adapter: 'qq', language: 'zh', limit: 20,
    hosts: ['ac.qq.com', 'qq.com'],
    threshold: { maxRank: 30 },
    note: '腾讯动漫排行榜（ac.qq.com/rank）',
  },
  {
    key: 'kuaikan', platform: '快看', collection: 'comics',
    tier: 'html', adapter: 'kuaikan', language: 'zh', limit: 20,
    hosts: ['kuaikanmanhua.com'],
    threshold: { maxRank: 30 },
    note: '快看排行榜',
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
    note: 'Wattpad 公开 API；不可达时回退榜单页解析',
  },
  {
    key: 'webnovel', platform: 'Webnovel', collection: 'novels',
    tier: 'html', adapter: 'webnovel', language: 'en', limit: 20,
    hosts: ['webnovel.com'],
    threshold: { maxRank: 30 },
    note: 'Webnovel 排行榜',
  },
  {
    key: 'wuxiaworld', platform: 'Wuxiaworld', collection: 'novels',
    tier: 'html', adapter: 'wuxiaworld', language: 'en', limit: 20,
    hosts: ['wuxiaworld.com'],
    threshold: { maxRank: 30 },
    note: 'Wuxiaworld 热门榜',
  },
  {
    key: 'fanqie', platform: '番茄小说', collection: 'novels',
    tier: 'manual', adapter: null, language: 'zh',
    hosts: ['fanqienovel.com', 'fanqie.tv'],
    note: '番茄反爬（字体加密），走 import.mjs 半自动录入',
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
