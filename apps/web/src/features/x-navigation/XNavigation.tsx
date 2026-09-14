import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";

import type { XSite } from "./sites";

export function XNavigation({ sites }: { sites: XSite[] }) {
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
              {sites.length} 个站点
            </span>
          </div>
        </header>

        {sites.length === 0 ? (
          <div className="nav-empty" style={{ paddingTop: 80 }}>
            <p style={{ margin: "0 0 8px" }}>暂无站点</p>
          </div>
        ) : (
          <div className="nav-grid">
            {sites.map((site) => {
              const hostname = new URL(site.url).hostname;
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
