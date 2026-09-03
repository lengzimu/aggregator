import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind()],
  output: 'static',
  // 站点域名：构建期读取 PUBLIC_SITE_URL（Cloudflare Pages / .env 配置），用于 canonical / OG / sitemap
  site: process.env.PUBLIC_SITE_URL || 'https://example.com',
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
});


