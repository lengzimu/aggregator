// HTTP 助手 —— 仅用 Node 18+ 内置 fetch，无第三方依赖。
// 采集器统一从这里发请求，便于集中控制 UA / 超时 / 重试。

const UA =
  process.env.HARVEST_UA ||
  'Mozilla/5.0 (compatible; HubLinksBot/1.0; +https://example.com/bot)';

export async function fetchText(url, opts = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeout ?? 15000);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, ...(opts.headers || {}) },
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
