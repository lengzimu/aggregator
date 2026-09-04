// HTTP 助手 —— 仅用 Node 18+ 内置 fetch，无第三方依赖。
// 采集器统一从这里发请求，便于集中控制 UA / 超时 / 重试。
//
// UA 策略（关键）：不同站点对 UA 反应完全不同——
//   · 桌面 UA：腾讯动漫 / Webtoon 等 PC 榜单页能正常返回 SSR 内容
//   · 移动 UA：快看等站点对桌面 UA 返回空壳，只有移动 UA 才返回含条目的 SSR
// 因此 fetchText 支持 opts.ua 按平台覆盖；默认用桌面 Chrome UA（不再是 bot UA，
// 否则多数站点直接拦截或返回空）。

export const DESKTOP_UA =
  process.env.HARVEST_UA_DESKTOP ||
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export const MOBILE_UA =
  process.env.HARVEST_UA_MOBILE ||
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';

const DEFAULT_UA = process.env.HARVEST_UA || DESKTOP_UA;

export async function fetchText(url, opts = {}) {
  const ua = opts.ua || DEFAULT_UA;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeout ?? 15000);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': ua, ...(opts.headers || {}) },
      redirect: 'follow',
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} @ ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJSON(url, opts = {}) {
  const text = await fetchText(url, {
    ...opts,
    headers: { Accept: 'application/json', ...(opts.headers || {}) },
  });
  return JSON.parse(text);
}
