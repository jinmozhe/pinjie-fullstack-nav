"use client";

import type { NavTaxonomyRead, PageResultPublicNavSiteRead, PublicNavSiteRead, SiteProfileRead } from "@pinjie/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Copy, ExternalLink, Globe, KeyRound, LogIn, LogOut, Search, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { SiteBrand } from "@/features/site";
import { ApiError, errorMessage } from "@/lib/api/http";
import { navigationApi } from "./api";

type Props = { profile: SiteProfileRead; initial?: { sites: PageResultPublicNavSiteRead; categories: NavTaxonomyRead[]; tags: NavTaxonomyRead[] }; initialError?: string; autoLogin: boolean; loginResult?: string };

function Accounts({ site, allowed, onClose }: { site: PublicNavSiteRead; allowed: boolean; onClose: () => void }) {
  const dialog = useRef<globalThis.HTMLDialogElement>(null);
  const [notice, setNotice] = useState("");
  const query = useQuery({ queryKey: ["reader-accounts", site.id], queryFn: ({ signal }) => navigationApi.accounts(site.id, signal), enabled: allowed, gcTime: 0, staleTime: 0, retry: false, refetchOnWindowFocus: "always", refetchInterval: 30000 });
  useEffect(() => { dialog.current?.showModal(); }, []);
  const copy = async (value: string) => {
    try { await window.navigator.clipboard.writeText(value); setNotice("已复制"); }
    catch { setNotice("复制失败，请手动选择文本复制"); }
  };
  return <dialog ref={dialog} className="nav-dialog" onCancel={onClose} onClose={onClose} aria-labelledby="nav-detail-title">
    <header><div><h2 id="nav-detail-title">{site.name}</h2><a href={site.url} target="_blank" rel="noopener noreferrer">访问站点 <ExternalLink size={14} /></a></div><IconButton title="关闭" onClick={onClose}><X size={20} /></IconButton></header>
    {site.description && <p className="nav-description">{site.description}</p>}
    <h3>帐号资料</h3>
    {!allowed ? <a className="primary-action" href="/api/navigation/start"><LogIn size={16} />管理员登录</a> : query.isError ? <div role="alert"><p>{errorMessage(query.error)}</p><button className="secondary-action" onClick={() => void query.refetch()}>重试</button></div> : query.isPending || query.isFetching ? <p role="status">正在核验查阅权限…</p> : query.data?.length ? <div className="nav-accounts">{query.data.map((account, index) => <article key={account.id} className="nav-account">
      <h4>{account.label || `帐号 ${index + 1}`}</h4>
      {([["用户名", account.username], ["密码", account.password], ["备注", account.notes]] as const).map(([label, value]) => value && <div className="nav-secret-row" key={label}><span>{label}</span><pre>{value}</pre><IconButton title={`复制${label}`} onClick={() => void copy(value)}><Copy size={16} /></IconButton></div>)}
    </article>)}</div> : <p className="nav-empty">暂无可查看的帐号资料</p>}
    <p role="status" aria-live="polite">{notice}</p>
  </dialog>;
}

export function Navigation({ profile, initial, initialError, autoLogin, loginResult }: Props) {
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [category, setCategory] = useState("");
  const [tag, setTag] = useState("");
  const [detail, setDetail] = useState<PublicNavSiteRead>();
  const [visible, setVisible] = useState(true);
  const [loggedOut, setLoggedOut] = useState(false);
  const probed = useRef(false);
  const identity = useQuery({ queryKey: ["reader-identity"], queryFn: ({ signal }) => navigationApi.me(signal), retry: false, gcTime: 0, staleTime: 0, refetchOnWindowFocus: "always", refetchInterval: 30000, enabled: !loggedOut });
  const sites = useQuery({ queryKey: ["navigation", page, search, category, tag], queryFn: ({ signal }) => navigationApi.sites(page, search, category, tag, signal), initialData: page === 1 && !search && !category && !tag ? initial?.sites : undefined });
  const categories = useQuery({ queryKey: ["nav-categories"], queryFn: () => navigationApi.taxonomy("categories"), initialData: initial?.categories });
  const tags = useQuery({ queryKey: ["nav-tags"], queryFn: () => navigationApi.taxonomy("tags"), initialData: initial?.tags });
  const forget = () => { setDetail(undefined); void client.cancelQueries({ queryKey: ["reader-accounts"] }); client.removeQueries({ queryKey: ["reader-accounts"] }); };
  const logout = useMutation({ mutationFn: navigationApi.logout, onMutate: forget, onSuccess: () => { setLoggedOut(true); client.removeQueries({ queryKey: ["reader-identity"] }); const channel = new window.BroadcastChannel("pinjie-reader"); channel.postMessage("logout"); channel.close(); } });
  useEffect(() => {
    const expire = () => { setDetail(undefined); client.removeQueries({ queryKey: ["reader-accounts"] }); };
    const visibility = () => { setVisible(document.visibilityState === "visible"); if (document.visibilityState !== "visible") expire(); };
    const channel = new window.BroadcastChannel("pinjie-reader");
    channel.onmessage = () => { expire(); setLoggedOut(true); client.removeQueries({ queryKey: ["reader-identity"] }); };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pinjie:reader-expired", expire);
    return () => { channel.close(); document.removeEventListener("visibilitychange", visibility); window.removeEventListener("pinjie:reader-expired", expire); };
  }, [client]);
  useEffect(() => {
    if (!loggedOut && autoLogin && !loginResult && !probed.current && identity.error instanceof ApiError && identity.error.status === 401) {
      probed.current = true;
      window.location.replace("/api/navigation/start?silent=1");
    }
  }, [autoLogin, loginResult, identity.error, loggedOut]);
  const allowed = !loggedOut && visible && identity.isSuccess && !identity.isFetching;
  return <main className="nav-shell">
    <header className="nav-header"><SiteBrand profile={profile} /><div className="nav-session">{!loggedOut && identity.isSuccess ? <><span>{identity.data.display_name}</span><button className="secondary-action" disabled={logout.isPending} onClick={() => logout.mutate()}><LogOut size={16} />退出登录</button></> : <a className="secondary-action" href="/api/navigation/start"><LogIn size={16} />管理员登录</a>}</div></header>
    <section className="nav-toolbar" aria-labelledby="nav-heading"><div><h1 id="nav-heading">{profile.name}导航</h1><p>{profile.description}</p></div><form role="search" onSubmit={(event) => { event.preventDefault(); setSearch(draft); setPage(1); }}><label className="nav-search"><Search size={20} /><input aria-label="搜索站点" placeholder="搜索站点名称、简介" maxLength={100} value={draft} onChange={(event) => setDraft(event.target.value)} /><IconButton title="搜索" type="submit"><ArrowRight size={18} /></IconButton></label></form></section>
    {(logout.isError || loginResult === "failed") && <p className="form-alert" role="alert">{logout.isError ? errorMessage(logout.error) : "管理员登录未完成，请重新登录"}</p>}
    {identity.isError && !(identity.error instanceof ApiError && identity.error.status === 401) && <p className="form-alert" role="alert">{errorMessage(identity.error)}</p>}
    <div className="nav-layout"><aside><h2>分类</h2><nav aria-label="站点分类"><button className={!category ? "active" : ""} onClick={() => { setCategory(""); setPage(1); }}>全部站点</button>{categories.data?.map((item) => <button key={item.id} className={category === item.id ? "active" : ""} onClick={() => { setCategory(item.id); setPage(1); }}>{item.name}</button>)}</nav></aside>
      <section className="nav-results" aria-label="站点列表"><div className="nav-results-bar"><span>{sites.data ? `${sites.data.total} 个站点` : "站点"}</span><label>标签 <select value={tag} onChange={(event) => { setTag(event.target.value); setPage(1); }}><option value="">全部标签</option>{tags.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
        {sites.isError || categories.isError || tags.isError ? <div className="nav-empty" role="alert"><p>{initialError || "导航加载失败，请重试"}</p><button className="secondary-action" onClick={() => { void sites.refetch(); void categories.refetch(); void tags.refetch(); }}>重新加载</button></div> : sites.isPending ? <p className="nav-empty" role="status">正在加载站点…</p> : sites.data?.items.length ? <div className="nav-grid">{sites.data.items.map((site) => <article className="nav-site" key={site.id}>
          <a href={site.url} target="_blank" rel="noopener noreferrer" className="nav-site-link">{site.icon_url ? <Image unoptimized src={site.icon_url} alt="" width={36} height={36} /> : <span className="nav-site-icon"><Globe size={24} /></span>}<h2>{site.name}</h2><ExternalLink size={15} /></a>
          <p>{site.description || new URL(site.url).hostname}</p><div className="nav-site-footer"><span>{site.category.name}</span><button className="nav-detail" onClick={() => setDetail(site)}><KeyRound size={15} />帐号资料</button></div>
        </article>)}</div> : <div className="nav-empty"><Globe size={32} /><p>{search || category || tag ? "没有符合条件的站点" : "暂无已发布站点"}</p></div>}
        <nav className="nav-pagination" aria-label="分页"><IconButton title="上一页" disabled={page <= 1 || sites.isFetching} onClick={() => setPage(page - 1)}><ArrowLeft size={18} /></IconButton><span>{page} / {Math.max(1, sites.data?.total_pages ?? 1)}</span><IconButton title="下一页" disabled={page >= (sites.data?.total_pages ?? 1) || sites.isFetching} onClick={() => setPage(page + 1)}><ArrowRight size={18} /></IconButton></nav>
      </section></div>
    <footer className="nav-footer"><span>{profile.name}</span><Link href="/account">用户中心</Link><Link href="/system-status">系统状态</Link></footer>
    {detail && <Accounts key={detail.id} site={detail} allowed={allowed} onClose={() => setDetail(undefined)} />}
  </main>;
}
