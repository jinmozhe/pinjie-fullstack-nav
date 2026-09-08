"use client";

import type { PublicNavSiteRead } from "@pinjie/api-client";
import { ExternalLink, Globe } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

export function SiteIcon({ site, size = 44 }: { site: PublicNavSiteRead; size?: number }) {
  const [failed, setFailed] = useState<string>();
  return <span className="nav-site-icon" aria-hidden="true">
    {site.icon_url && failed !== site.icon_url
      ? <Image unoptimized src={site.icon_url} alt="" width={size} height={size} onError={() => setFailed(site.icon_url ?? undefined)} />
      : <Globe size={Math.round(size * 0.55)} />}
  </span>;
}

export function SiteCard({ site, onOpen }: { site: PublicNavSiteRead; onOpen: (site: PublicNavSiteRead) => void }) {
  return <article className="nav-site">
    <button type="button" className="nav-site-body" aria-label={`查看 ${site.name} 详情`} onClick={() => onOpen(site)} />
    <div className="nav-site-top">
      <SiteIcon site={site} />
      <div className="nav-site-name"><h3 title={site.name}>{site.name}</h3><span title={site.url}>{new URL(site.url).hostname}</span></div>
    </div>
    <a className="nav-site-external" href={site.url} target="_blank" rel="noopener noreferrer" aria-label={`访问 ${site.name}（新窗口）`} title="访问站点（新窗口）"><ExternalLink size={16} /></a>
    <p>{site.description}</p>
  </article>;
}
