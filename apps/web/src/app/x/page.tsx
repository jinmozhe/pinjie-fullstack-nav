import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";

import "@/features/navigation/navigation.css";

export const metadata: Metadata = {
  title: "私密导航",
  robots: "noindex, nofollow",
};

interface StaticSite {
  name: string;
  url: string;
  description: string;
}

/**
 * 静态私密站点列表
 * 本页面为独立私密路由（/x），首页与侧边栏均无入口，不经过数据库。
 * 请在此数组中按格式添加需要展示的站点信息。
 */
const SITES: StaticSite[] = [
  {
    name: "91porn",
    url: "https://www.91porn.com/",
    description: "成人视频站点。",
  },
  {
    name: "Pornhub",
    url: "https://pornhub.com/",
    description: "成人视频分享平台",
  },
  {
    name: "XVIDEOS",
    url: "https://www.xvideos.com/",
    description: "成人视频平台。",
  },
  {
    name: "XP1024",
    url: "http://www.xp1024.com/",
    description: "1024 类站点入口。",
  },
  {
    name: "草榴社区",
    url: "https://www.t66y.com/",
    description: "成人内容社区论坛。",
  },
  {
    name: "Sukebei",
    url: "https://sukebei.nyaa.si/",
    description: "成人向种子索引站点。",
  },
  {
    name: "Yandex",
    url: "https://yandex.com/",
    description: "俄罗斯搜索引擎，支持成人内容搜索。",
  },
  {
    name: "Semrush 成人网站排名",
    url: "https://zh.semrush.com/trending-websites/global/adult",
    description: "成人网站流量排名资料页。",
  },
  {
    name: "xHamster",
    url: "https://xhamster.com/",
    description: "成人视频平台，榜单显示 2026 年 7 月访问量约 16.6 亿。",
  },
  {
    name: "XNXX",
    url: "https://xnxx.com/",
    description: "成人视频平台，榜单显示 2026 年 7 月访问量约 10.9 亿。",
  },
  {
    name: "OnlyFans",
    url: "https://onlyfans.com/",
    description:
      "创作者订阅平台，含大量成人内容，榜单显示 2026 年 7 月访问量约 4.05 亿。",
  },
  {
    name: "ThePornDude",
    url: "https://theporndude.com/",
    description:
      "成人网站导航和资源站，榜单显示 2026 年 7 月访问量约 2.36 亿。",
  },
  {
    name: "Patreon",
    url: "https://patreon.com/",
    description:
      "创作者会员订阅平台，可能包含成人创作者内容，榜单显示 2026 年 7 月访问量约 2.28 亿。",
  },
  {
    name: "XVIDEOS.es",
    url: "https://xvideos.es/",
    description:
      "XVIDEOS 的西语相关成人视频站点，榜单显示 2026 年 7 月访问量约 2.03 亿。",
  },
  {
    name: "DeviantArt",
    url: "https://deviantart.com/",
    description:
      "艺术作品社区，可能包含成人或敏感艺术内容，榜单显示 2026 年 7 月访问量约 1.79 亿。",
  },
  {
    name: "Yandex Turkey",
    url: "https://yandex.com.tr/",
    description:
      "土耳其版 Yandex 搜索入口，榜单将其列入成人相关流量来源，具体原因置信度低。",
  },
  {
    name: "xHamsterLive",
    url: "https://xhamsterlive.com/",
    description: "成人直播平台，榜单显示 2026 年 7 月访问量约 1.38 亿。",
  },
  {
    name: "FPO.xxx",
    url: "https://fpo.xxx/",
    description: "成人内容站点，榜单显示 2026 年 7 月访问量约 1.32 亿。",
  },
  {
    name: "Rutube",
    url: "https://rutube.ru/",
    description:
      "俄罗斯视频平台，榜单将其列入成人相关流量来源，具体原因置信度低。",
  },
  {
    name: "Qorno",
    url: "https://qorno.com/",
    description:
      "成人内容搜索或聚合站点，榜单显示 2026 年 7 月访问量约 1.32 亿。",
  },
  {
    name: "PornPics",
    url: "https://pornpics.com/",
    description: "成人图片站点，榜单显示 2026 年 7 月访问量约 1.19 亿。",
  },
  {
    name: "DLsite",
    url: "https://dlsite.com/",
    description:
      "数字作品销售平台，含成人向同人、游戏和音声内容，榜单显示 2026 年 7 月访问量约 1.15 亿。",
  },
  {
    name: "F95zone",
    url: "https://f95zone.to/",
    description:
      "成人游戏和成人内容社区论坛，榜单显示 2026 年 7 月访问量约 1.15 亿。",
  },
  {
    name: "xHamster19",
    url: "https://xhamster19.com/",
    description:
      "xHamster 相关成人视频站点，榜单显示 2026 年 7 月访问量约 1.05 亿。",
  },
  {
    name: "Redtube",
    url: "https://redtube.com/",
    description: "成人视频平台，榜单显示 2026 年 7 月访问量约 1.04 亿。",
  },
  {
    name: "Beeg",
    url: "https://beeg.com/",
    description: "成人视频平台，榜单显示 2026 年 7 月访问量约 1.03 亿。",
  },
  {
    name: "7mmtv.sx",
    url: "https://7mmtv.sx/",
    description: "日本成人视频观看站点。",
  },
  {
    name: "91porna",
    url: "https://91porna.com/",
    description: "成人视频和自拍内容站点。",
  },
  {
    name: "AV01.tv",
    url: "https://www.av01.media/jp",
    description: "日语成人视频流媒体站点。",
  },
  {
    name: "PornTrex",
    url: "https://www.porntrex.com/",
    description: "成人视频平台。",
  },
  {
    name: "SpankBang",
    url: "https://spankbang.com/",
    description: "成人视频平台。",
  },
  {
    name: "YouPorn",
    url: "https://www.youporn.com/",
    description: "成人视频平台。",
  },
  {
    name: "EPORNER",
    url: "https://www.eporner.com/",
    description: "成人视频平台。",
  },
  {
    name: "Jable.TV",
    url: "https://jable.tv/",
    description: "日本成人视频观看站点。",
  },
  {
    name: "JavBus",
    url: "https://www.javbus.com/",
    description: "日本成人影片资料和磁力链接分享站点。",
  },
  {
    name: "JavDB",
    url: "https://javdb.com/",
    description: "日本成人影片资料库。",
  },
  {
    name: "SupJav",
    url: "https://supjav.com/",
    description: "日本成人视频在线播放站点。",
  },
  {
    name: "Tube8",
    url: "https://www.tube8.com/",
    description: "成人视频平台。",
  },
  {
    name: "禁漫天堂",
    url: "https://18comic.vip/",
    description: "成人漫画站点。",
  },
  {
    name: "Hplives",
    url: "https://zh.hplives.com/",
    description: "成人视频直播站点。",
  },
];

export default function PrivateNavigationPage() {
  return (
    <main className="nav-standalone">
      <div className="nav-standalone-container">
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 28,
            paddingBottom: 16,
            borderBottom: "1px solid var(--line)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Link
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                color: "var(--muted, #666)",
                textDecoration: "none",
                fontSize: 14,
              }}
            >
              <ArrowLeft size={16} />
              <span>返回首页</span>
            </Link>
            <h1
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 650,
                color: "var(--ink, #1f2027)",
              }}
            >
              私密导航
            </h1>
            <span style={{ fontSize: 13, color: "var(--muted, #888)" }}>
              {SITES.length} 个站点
            </span>
          </div>
        </header>

        {SITES.length === 0 ? (
          <div className="nav-empty" style={{ paddingTop: 80 }}>
            <p style={{ margin: "0 0 8px" }}>暂无固定站点配置</p>
            <p style={{ fontSize: 13, color: "var(--muted, #888)" }}>
              请在 <code>apps/web/src/app/x/page.tsx</code> 文件的{" "}
              <code>SITES</code> 数组中添加您的站点。
            </p>
          </div>
        ) : (
          <div className="nav-grid">
            {SITES.map((site) => {
              let hostname = "";
              try {
                hostname = new URL(site.url).hostname;
              } catch {
                hostname = site.url;
              }
              return (
                <article className="nav-site" key={site.url}>
                  <a
                    className="nav-site-body"
                    href={site.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`访问 ${site.name}`}
                  />
                  <div className="nav-site-top">
                    <div className="nav-site-name">
                      <h3 title={site.name}>{site.name}</h3>
                      <span title={site.url}>{hostname}</span>
                    </div>
                  </div>
                  <a
                    className="nav-site-external"
                    href={site.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`访问 ${site.name}（新窗口）`}
                    title="访问站点（新窗口）"
                  >
                    <ExternalLink size={16} />
                  </a>
                  <p title={site.description}>{site.description}</p>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
