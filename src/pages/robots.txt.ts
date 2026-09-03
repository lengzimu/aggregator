import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

/**
 * 动态生成 robots.txt：随构建期 site（PUBLIC_SITE_URL）自动写出正确的 Sitemap 绝对地址。
 *
 * 详情跳转页（/videos/<slug>/）已在页面层标 noindex，这里再 Disallow 一次，双保险。
 *
 * 注意：这里**不能**用通配写法（形如 Disallow 后面跟「分类名 + 通配符 + 斜杠」）。
 * robots 语法里的通配符匹配任意字符序列，那样的规则会连带屏蔽掉
 * /comics/platform/webtoon/ 与 /comics/page/2/ 这些我们希望被抓取的
 * 静态筛选页与分页页。因此改为逐个条目枚举精确路径。
 *
 * 另外：getCollection 的集合名必须是**字面量** —— Astro 在编译期做静态分析并把每个集合
 * 替换成对应的内部引用，传变量会导致构建期 `xxx is not defined`。
 */
export const GET: APIRoute = async ({ site }) => {
  const base = (site ?? new URL('https://example.com')).toString();

  const groups = [
    ['videos', await getCollection('videos')],
    ['comics', await getCollection('comics')],
    ['novels', await getCollection('novels')],
  ] as const;

  const detailPaths: string[] = [];
  for (const [type, entries] of groups) {
    for (const e of entries) {
      const lang = e.data.language ?? 'zh';
      const prefix = lang === 'en' ? '/en/' : '/';
      detailPaths.push(`${prefix}${type}/${e.id}/`);
    }
  }
  detailPaths.sort();

  const body = `User-agent: *
Allow: /

# 跳转详情页不参与索引（页面本身已带 noindex），仅做导流用
${detailPaths.map((p) => `Disallow: ${p}`).join('\n')}

# 前端搜索页无独立可索引内容
Disallow: /search/
Disallow: /en/search/

Sitemap: ${new URL('/sitemap-index.xml', base).href}
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
