import type { Lang } from './ui.ts';

export interface StaticSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface StaticPageData {
  title: string;
  intro: string;
  sections: StaticSection[];
  updated: string;
}

/** 合规页面正文（中 / 英）。上线前请替换其中的占位邮箱。 */
export const staticPages = {
  about: {
    zh: {
      title: '关于我们',
      intro: 'HubLinks 是一个内容发现与导流站。我们只做一件事：把值得一看的内容，用一条链接指回它的官方出处。',
      updated: '内容收录原则',
      sections: [
        {
          heading: '我们不托管任何内容',
          paragraphs: [
            '本站不存储、不缓存、不转码任何视频、图片或小说正文。所有封面图均通过外链引用，所有正文阅读与视频观看都发生在原站。',
            '点击任意条目，你会通过一条跳转链接到达内容所在的官方平台。跳转页面本身不承载任何受版权保护的材料。',
          ],
        },
        {
          heading: '我们收录什么',
          bullets: [
            '仅收录正版平台上的公开作品页，包括 Webtoon、Tapas、腾讯动漫、快看、Webnovel、Wattpad、Wuxiaworld、番茄小说等',
            '优先收录点击量高、评分高或近期增长快的作品，热度数据来自各平台公开榜单',
            '不收录任何盗版站点、网盘聚合站或未授权转载页面',
            '不收录含有违法、色情、暴力等违规内容的条目',
          ],
        },
        {
          heading: '内容如何产生',
          paragraphs: [
            '海外平台中提供公开接口的，我们通过定时脚本读取其公开榜单数据；其余平台由编辑人工核对榜单后录入。',
            '所有自动采集的结果都会先进入待审核队列，经人工确认后才会在本站上线。',
          ],
        },
        {
          heading: '发现错漏',
          paragraphs: [
            '如果你发现某条链接失效、信息有误，或认为某条内容不应被收录，请通过 DMCA 页面或隐私政策页中的联系方式告知我们，我们会在核实后尽快处理。',
          ],
        },
      ],
    },
    en: {
      title: 'About us',
      intro:
        'HubLinks is a content discovery hub. We do exactly one thing: point you back to the official source with a single link.',
      updated: 'What we index',
      sections: [
        {
          heading: 'We host nothing',
          paragraphs: [
            'We do not store, cache or transcode any video, image or novel text. Cover images are referenced remotely; reading and watching always happen on the source platform.',
            'Clicking any entry takes you through a redirect to the official platform that publishes the work. The redirect page itself carries no copyrighted material.',
          ],
        },
        {
          heading: 'What we include',
          bullets: [
            'Public work pages on licensed platforms only: Webtoon, Tapas, Tencent Comic, Kuaikan, Webnovel, Wattpad, Wuxiaworld, Fanqie Novel and similar',
            'We prioritise high-traffic, high-rated or fast-growing titles, using each platform’s public ranking data',
            'No piracy sites, no file-lockers, no unauthorised reprints',
            'No content that is illegal or violates platform policies',
          ],
        },
        {
          heading: 'How entries are produced',
          paragraphs: [
            'Where a platform exposes a public interface, a scheduled script reads its public rankings. Everything else is added by an editor after checking the ranking manually.',
            'Every automated result lands in a review queue first and only goes live after a human confirms it.',
          ],
        },
        {
          heading: 'Spot something wrong',
          paragraphs: [
            'If a link is broken, data is wrong, or you believe an entry should not be listed, reach us through the contact on the DMCA or privacy page and we will act on it after review.',
          ],
        },
      ],
    },
  },

  editorialPolicy: {
    zh: {
      title: '收录标准与编辑方针',
      intro:
        '这一页说明我们收录什么、不收录什么、依据什么排序，以及数据多久核对一次。可以把它当作本站的编辑手册。',
      updated: '编辑方针',
      sections: [
        {
          heading: '收录的硬门槛',
          bullets: [
            '只收录白名单内正版平台的公开作品页；平台清单随代码一同维护，未登记的平台无法入库',
            '条目必须带有可回溯的官方源站链接，任何找不到出处的作品都不收录',
            '不收录盗版站点、网盘聚合站与未授权转载页面',
            '不收录违法或违反平台政策的内容',
          ],
        },
        {
          heading: '热度与排序依据',
          paragraphs: [
            '排序综合读者评分、近 7 日增长、播放或阅读量、订阅数与平台榜单名次。指标缺失的条目不会被隐藏，但会排在末尾。',
            '我们不销售排名，也不接受付费置顶。榜单位置完全由上述指标计算得出。',
          ],
        },
        {
          heading: '人工审核',
          paragraphs: [
            '自动采集的结果一律先进入待审核队列，经人工确认后才上线。需要人眼判断的部分——是否正版、封面是否合规、作者信息是否准确——不参与自动放行。',
            '每条上线内容都附有编辑撰写的短评，只写源站没有的增量信息：适合谁看、看点在何处、有什么坑。我们不复制剧情简介，那既无增量价值也构成重复内容。',
          ],
        },
        {
          heading: '数据核对与下架',
          paragraphs: [
            '热度指标会定期重新采集，卡片上标注的「数据更新于」即为该条指标的最后核对日期。',
            '我们定时回抓已上线条目的源站链接。源站删除或下架的作品会自动移出列表；遇到反爬、限流、超时等无法判定的情况一律保留——宁可放过，绝不误杀。',
          ],
        },
        {
          heading: '利益冲突',
          paragraphs: [
            '本站部分外链为联盟营销链接，点击并完成购买我们可能获得少量佣金。这不会增加你的任何费用，也不影响收录与排序。',
          ],
        },
      ],
    },
    en: {
      title: 'Editorial policy',
      intro:
        'What we list, what we refuse, how we rank it, and how often the data is checked. Treat this page as our editorial handbook.',
      updated: 'Editorial standards',
      sections: [
        {
          heading: 'Hard requirements',
          bullets: [
            'Public work pages on whitelisted licensed platforms only; the platform list ships with the code and anything unregistered cannot be added',
            'Every entry needs a traceable link back to the official source — no verifiable origin means no listing',
            'No piracy sites, no file-lockers, no unauthorised reprints',
            'No illegal content and nothing that breaks platform policies',
          ],
        },
        {
          heading: 'How ranking works',
          paragraphs: [
            'Ranking blends reader rating, seven-day growth, view or read counts, subscriber numbers and platform chart position. Entries with missing metrics are never hidden, they simply sort to the end.',
            'We do not sell placement and we do not accept payment for position. Chart order is computed from those metrics alone.',
          ],
        },
        {
          heading: 'Human review',
          paragraphs: [
            'Automated collection always lands in a review queue first and only goes live after a human confirms it. Anything needing human judgement — whether a title is legitimate, whether a cover is appropriate, whether author details are correct — is never auto-approved.',
            'Every live entry carries an editorially written note that only adds what the source does not say: who it suits, where the appeal lies, what will annoy you. We do not copy plot summaries; that adds no value and creates duplicate content.',
          ],
        },
        {
          heading: 'Data checks and removal',
          paragraphs: [
            'Metrics are re-collected on a schedule, and the date shown on each card is when that entry was last verified.',
            'We re-check the source link of every live entry on a schedule. Titles removed by their platform are dropped automatically; anything we cannot confirm because of bot protection, rate limits or timeouts is always kept — better a stale link than a wrongly deleted one.',
          ],
        },
        {
          heading: 'Conflicts of interest',
          paragraphs: [
            'Some outbound links are affiliate links, so a purchase made through them may earn us a small commission. It costs you nothing extra and never affects what we list or how we rank it.',
          ],
        },
      ],
    },
  },

  disclaimer: {
    zh: {
      title: '免责声明',
      intro: '使用本站即表示你已阅读并同意以下条款。',
      updated: '最后更新：见页面底部',
      sections: [
        {
          heading: '链接索引服务',
          paragraphs: [
            '本站是链接索引服务，功能等同于一个经过人工筛选的收藏夹。我们不对第三方网站上的内容负责，也无法控制其内容、可用性或隐私实践。',
          ],
        },
        {
          heading: '版权归属',
          paragraphs: [
            '所有作品的权利归原作者与发布平台所有。本站不主张任何权利，也不对作品做任何修改、复制或再分发。',
            '如你是权利人且认为某条链接侵犯了你的权益，请按 DMCA 页面说明提交通知。',
          ],
        },
        {
          heading: '链接有效性',
          paragraphs: [
            '我们每日检查收录链接，但第三方平台可能因下架、改版或地区限制导致链接失效。我们不对因链接失效造成的任何损失负责。',
          ],
        },
        {
          heading: '联盟与广告',
          paragraphs: [
            '本站部分链接为联盟营销链接，我们可能因此获得佣金，这不会增加你的费用。广告内容由第三方网络提供，我们不对其负责。',
          ],
        },
      ],
    },
    en: {
      title: 'Disclaimer',
      intro: 'By using this site you confirm that you have read and accepted the terms below.',
      updated: 'Last updated: see footer',
      sections: [
        {
          heading: 'A link index service',
          paragraphs: [
            'This site is a link index — functionally a hand-filtered bookmark collection. We are not responsible for content on third-party sites and cannot control what they publish, whether they stay online, or how they handle privacy.',
          ],
        },
        {
          heading: 'Copyright',
          paragraphs: [
            'All rights in the works belong to their authors and the platforms that publish them. We claim no rights and do not modify, copy or redistribute any work.',
            'If you are a rights holder and believe a link infringes your rights, follow the process on the DMCA page.',
          ],
        },
        {
          heading: 'Link availability',
          paragraphs: [
            'We check indexed links daily, but third-party platforms may remove works, redesign, or apply regional restrictions. We accept no liability for losses caused by a dead link.',
          ],
        },
        {
          heading: 'Affiliates and ads',
          paragraphs: [
            'Some links are affiliate links and we may earn a commission from them at no extra cost to you. Advertisements are served by third-party networks and are not our responsibility.',
          ],
        },
      ],
    },
  },

  privacy: {
    zh: {
      title: '隐私政策',
      intro: '我们尽可能少地收集数据。下面是完整的说明。',
      updated: '数据实践',
      sections: [
        {
          heading: '我们收集什么',
          bullets: [
            '基本访问日志（页面 URL、时间、粗略地区），由托管平台记录，用于排查故障与统计流量',
            '搜索关键词仅在浏览器本地处理，不会发送到我们的服务器',
            '我们不要求注册，不收集姓名、邮箱或支付信息',
          ],
        },
        {
          heading: '跳转时的隐私保护',
          paragraphs: [
            '跳转页不设置来源引用（no-referrer），目标平台无法从引用头判断访客来自本站。封面图加载同样不发送引用信息。',
          ],
        },
        {
          heading: '第三方服务',
          bullets: [
            '托管服务（如 Cloudflare Pages）会记录标准访问日志',
            '广告网络与联盟平台可能设置 Cookie 以归因转化，详情见其各自隐私政策',
            '我们不向第三方出售或出租任何访客数据',
          ],
        },
        {
          heading: '你的选择',
          paragraphs: [
            '你可通过浏览器设置阻止 Cookie 与使用广告拦截工具，本站核心功能（浏览与跳转）不依赖 Cookie，仍可正常使用。',
            '如需行使数据主体权利，请通过本页底部邮箱联系我们。',
          ],
        },
      ],
    },
    en: {
      title: 'Privacy policy',
      intro: 'We collect as little as possible. Here is the full picture.',
      updated: 'Data practices',
      sections: [
        {
          heading: 'What we collect',
          bullets: [
            'Basic access logs (page URL, timestamp, coarse region) recorded by our hosting provider for troubleshooting and traffic statistics',
            'Search terms are processed in your browser only and never sent to our servers',
            'No registration, so we collect no name, email or payment data',
          ],
        },
        {
          heading: 'Privacy on redirect',
          paragraphs: [
            'Redirect pages send no referrer (no-referrer), so the destination platform cannot tell from the referrer header that you came from us. Cover images load the same way.',
          ],
        },
        {
          heading: 'Third parties',
          bullets: [
            'Our host (for example Cloudflare Pages) records standard access logs',
            'Ad networks and affiliate platforms may set cookies to attribute conversions — see their own policies for details',
            'We never sell or rent visitor data to anyone',
          ],
        },
        {
          heading: 'Your choices',
          paragraphs: [
            'You can block cookies in your browser or use an ad blocker. Browsing and redirecting — the core of this site — do not depend on cookies and will keep working.',
            'To exercise your data rights, contact us at the email in the footer.',
          ],
        },
      ],
    },
  },

  dmca: {
    zh: {
      title: 'DMCA 版权投诉',
      intro: '我们尊重知识产权，并会对符合要求的侵权通知迅速处理。',
      updated: '投诉流程',
      sections: [
        {
          heading: '我们不接受什么',
          paragraphs: [
            '本站不托管任何受版权保护的文件，因此不存在"本站服务器上的侵权副本"。所有内容均留存于其原发布平台。',
            '如果你的作品被第三方平台未经授权发布，请直接向该平台投诉——那才是内容实际所在之处。',
          ],
        },
        {
          heading: '如认为本站链接不当，请提交包含以下内容的通知',
          bullets: [
            '你的姓名、联系方式（含电子邮箱）与签名',
            '被侵权作品的标识，或作品清单',
            '你主张被侵权的本站页面完整 URL',
            '声明你善意相信该使用未经授权',
            '声明通知内容准确，且你有权代表权利人行事',
          ],
        },
        {
          heading: '发送至',
          paragraphs: [
            '请将通知发送至 {{DMCA_EMAIL}}（上线前替换为真实邮箱）。我们通常在收到完整通知后的 3 个工作日内处理并回复。',
          ],
        },
        {
          heading: '反通知',
          paragraphs: [
            '如你认为某条链接被错误移除，可提交反通知，说明移除依据有误，并同意接受相关司法管辖。',
          ],
        },
      ],
    },
    en: {
      title: 'DMCA notice',
      intro: 'We respect intellectual property and act quickly on valid notices.',
      updated: 'Process',
      sections: [
        {
          heading: 'What we cannot do',
          paragraphs: [
            'This site hosts no copyrighted files, so there is no infringing copy on our servers to remove. Every work stays on the platform that published it.',
            'If your work was posted without authorisation on a third-party platform, complain to that platform — that is where the content actually lives.',
          ],
        },
        {
          heading: 'To report an improper link, send a notice containing',
          bullets: [
            'Your name, contact details including email, and a signature',
            'Identification of the infringed work, or a representative list',
            'The full URL of the page on this site you are challenging',
            'A statement that you believe in good faith the use is unauthorised',
            'A statement that the notice is accurate and that you act for the rights holder',
          ],
        },
        {
          heading: 'Where to send it',
          paragraphs: [
            'Send notices to {{DMCA_EMAIL}} (replace with a real address before launch). Complete notices are usually handled within three business days.',
          ],
        },
        {
          heading: 'Counter-notice',
          paragraphs: [
            'If you believe a link was removed by mistake, send a counter-notice explaining why the removal was unfounded and consenting to the relevant jurisdiction.',
          ],
        },
      ],
    },
  },
} as const satisfies Record<string, Record<Lang, StaticPageData>>;

export type StaticPageKey = keyof typeof staticPages;

export function getStaticPage(key: StaticPageKey, lang: Lang): StaticPageData {
  return staticPages[key][lang] as StaticPageData;
}
