"use client";

import type { PublicNavSiteRead } from "@pinjie/api-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Folder, RefreshCw, Tag, X } from "lucide-react";
import { useEffect, useState } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { ApiError, errorMessage } from "@/lib/api/http";
import { HOME_LOCATION, type NavigationLocation } from "@/lib/navigation-location";
import { navigationApi } from "./api";
import { NavigationLink } from "./NavigationLink";
import { SiteIcon } from "./SiteCard";
import { useModal } from "./useModal";

function Accounts({ siteId }: { siteId: string }) {
  const client = useQueryClient();
  const [notice, setNotice] = useState("");
  const query = useQuery({ queryKey: ["reader-accounts", siteId], queryFn: ({ signal }) => navigationApi.accounts(siteId, signal), gcTime: 0, staleTime: 0, retry: false, refetchOnWindowFocus: "always", refetchInterval: 30000 });
  const denied = query.error instanceof ApiError && [401, 403].includes(query.error.status);
  useEffect(() => {
    if (denied) void client.invalidateQueries({ queryKey: ["reader-identity"] });
  }, [client, denied]);
  useEffect(() => () => {
    void client.cancelQueries({ queryKey: ["reader-accounts", siteId] });
    client.removeQueries({ queryKey: ["reader-accounts", siteId] });
  }, [client, siteId]);
  async function copy(value: string) {
    try { await window.navigator.clipboard.writeText(value); setNotice("已复制"); }
    catch { setNotice("复制失败，请手动选择文本复制"); }
  }
  if (denied) return null;
  if (query.isError) return <div className="nav-account-status" role="alert"><p>{errorMessage(query.error)}</p><button className="secondary-action" onClick={() => void query.refetch()}><RefreshCw size={16} />重试</button></div>;
  if (query.isPending || query.isFetching) return <div className="nav-account-status nav-account-skeleton" role="status" aria-label="正在核验帐号资料"><span /><span /><span /></div>;
  if (!query.data.length) return null;
  return <section className="nav-accounts" aria-labelledby="nav-accounts-heading">
    <div className="nav-accounts-heading"><h3 id="nav-accounts-heading">帐号资料</h3><span>{query.data.length} 个帐号</span></div>
    {query.data.map((account, index) => <article key={account.id} className="nav-account">
      <h4>{account.label || `帐号 ${index + 1}`}</h4>
      {([["用户名", account.username], ["密码", account.password], ["备注", account.notes]] as const).map(([label, value]) => value && <div className="nav-secret-row" key={label}>
        <span>{label}</span><pre>{value}</pre><IconButton title={`复制${label}`} onClick={() => void copy(value)}><Copy size={16} /></IconButton>
      </div>)}
    </article>)}
    {notice && <p className="nav-copy-notice" role="status">{notice}</p>}
  </section>;
}

export function SiteDetail({ siteId, reader, scope, suspended, onClose, onNavigate }: {
  siteId: string;
  reader: boolean;
  scope: readonly string[];
  suspended: boolean;
  onClose: () => void;
  onNavigate: (location: NavigationLocation) => void;
}) {
  const dialog = useModal();
  const query = useQuery({ queryKey: [...scope, "detail", siteId], queryFn: ({ signal }) => navigationApi.site(siteId, reader, signal), enabled: !suspended, gcTime: 0, staleTime: 0, retry: false, refetchOnWindowFocus: "always", refetchInterval: 30000 });
  const site: PublicNavSiteRead | undefined = !suspended && !query.isError ? query.data : undefined;
  return <dialog ref={dialog} className="nav-dialog" onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} aria-labelledby="nav-detail-title">
    <div className="nav-dialog-close"><IconButton title="关闭详情" onClick={onClose}><X size={20} /></IconButton></div>
    <div className="nav-dialog-content">
      {site ? <>
        <header className="nav-detail-header"><SiteIcon key={site.id} site={site} size={64} /><div className="nav-detail-name"><h2 id="nav-detail-title">{site.name}</h2><div className="nav-detail-url"><span title={site.url}>{site.url}</span><a href={site.url} target="_blank" rel="noopener noreferrer" aria-label={`访问 ${site.name}（新窗口）`} title="访问站点（新窗口）"><ExternalLink size={16} /></a></div></div></header>
        {site.description && <p className="nav-description">{site.description}</p>}
        <div className="nav-detail-taxonomy">
          <NavigationLink className="nav-taxonomy-link" location={{ ...HOME_LOCATION, category: site.category.id }} onNavigate={onNavigate}><Folder size={16} aria-hidden="true" /><span>{site.category.name}</span></NavigationLink>
          {!!site.tags.length && <div className="nav-detail-tags">{site.tags.map(tag => <NavigationLink key={tag.id} className="nav-taxonomy-link" location={{ ...HOME_LOCATION, tag: tag.id }} onNavigate={onNavigate}><Tag size={16} aria-hidden="true" /><span>{tag.name}</span></NavigationLink>)}</div>}
        </div>
        {reader && !query.isFetching && <Accounts siteId={site.id} />}
      </> : <>
        <h2 id="nav-detail-title">站点详情</h2>
        {query.isError && !suspended ? <div className="nav-empty" role="alert"><p>{errorMessage(query.error)}</p><button className="secondary-action" onClick={() => void query.refetch()}><RefreshCw size={16} />重试</button></div> : <div className="nav-account-skeleton" role="status" aria-label="正在加载站点详情"><span /><span /><span /></div>}
      </>}
    </div>
  </dialog>;
}
