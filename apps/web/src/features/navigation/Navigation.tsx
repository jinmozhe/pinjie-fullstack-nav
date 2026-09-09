"use client";

import type { NavCategoryRead, NavTaxonomyRead, PageResultNavSiteGroupRead, PageResultPublicNavSiteRead, ReaderIdentityRead, SiteProfileRead } from "@pinjie/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Globe, LogIn, LogOut, Menu, Pin, RefreshCw, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { SiteBrand } from "@/features/site";
import { ApiError, errorMessage } from "@/lib/api/http";
import { HOME_LOCATION, TOP_LOCATION, isNavigationHome, navigationHref, navigationLocation, type NavigationLocation } from "@/lib/navigation-location";
import { navigationApi } from "./api";
import { NavigationLink } from "./NavigationLink";
import { NavigationDrawer, SidebarContent } from "./NavigationSidebar";
import { SiteCard } from "./SiteCard";
import { SiteDetail } from "./SiteDetail";
import "./navigation.css";

type Props = {
  profile: SiteProfileRead;
  initial?: { sites?: PageResultPublicNavSiteRead; groups?: PageResultNavSiteGroupRead; categories: NavCategoryRead[]; tags: NavTaxonomyRead[]; reader?: ReaderIdentityRead };
  initialLocation?: NavigationLocation;
  initialError?: string;
  autoLogin: boolean;
  loginResult?: string;
};

const queryPolicy = { gcTime: 0, staleTime: 0, retry: false, refetchInterval: 30000, refetchOnWindowFocus: "always" as const };

export function Navigation({ profile, initial, initialLocation = HOME_LOCATION, initialError, autoLogin, loginResult }: Props) {
  const client = useQueryClient();
  const [location, setLocation] = useState(initialLocation);
  const [draft, setDraft] = useState(initialLocation.search);
  const [detailId, setDetailId] = useState<string>();
  const [drawer, setDrawer] = useState(false);
  const [visible, setVisible] = useState(true);
  const [loggedOut, setLoggedOut] = useState(false);
  const [initialAvailable, setInitialAvailable] = useState(true);
  const [blockedAt, setBlockedAt] = useState(0);
  const probed = useRef(false);
  const heading = useRef<globalThis.HTMLHeadingElement>(null);
  const focusResults = useRef(false);
  const home = isNavigationHome(location);
  const identity = useQuery({ queryKey: ["reader-identity"], queryFn: ({ signal }) => navigationApi.me(signal), initialData: initialAvailable ? initial?.reader : undefined, ...queryPolicy, enabled: !loggedOut });
  const reader = !loggedOut && identity.isSuccess && identity.dataUpdatedAt > blockedAt && Date.parse(identity.data.expires_at) > Date.now();
  const lastReader = useRef(reader);
  const scope = reader ? ["reader-navigation", identity.data.admin_id] : ["public-navigation"];
  const suspended = reader && (!visible || identity.isLoading);
  const useInitial = initialAvailable && Boolean(initial?.reader) === reader;
  const sameInitialLocation = navigationHref(location) === navigationHref(initialLocation);
  const closeDetail = useCallback(() => {
    setDetailId(undefined);
    void client.cancelQueries({ queryKey: ["reader-accounts"] });
    client.removeQueries({ queryKey: ["reader-accounts"] });
    for (const key of ["reader-navigation", "public-navigation"]) {
      void client.cancelQueries({ queryKey: [key], predicate: query => query.queryKey.includes("detail") });
      client.removeQueries({ queryKey: [key], predicate: query => query.queryKey.includes("detail") });
    }
  }, [client]);
  const clearPrivate = useCallback(() => {
    setInitialAvailable(false);
    closeDetail();
    for (const key of ["reader-navigation", "reader-accounts"]) {
      void client.cancelQueries({ queryKey: [key] });
      client.removeQueries({ queryKey: [key] });
    }
  }, [client, closeDetail]);
  const navigate = useCallback((next: NavigationLocation) => {
    closeDetail(); setDrawer(false); setInitialAvailable(false);
    if (Boolean(next.top) !== (window.location.pathname === "/top")) {
      window.location.assign(navigationHref(next));
      return;
    }
    setLocation(next); setDraft(next.search); focusResults.current = true;
    window.history.pushState(null, "", navigationHref(next));
  }, [closeDetail]);
  const resetSelection = useCallback(() => {
    const next = window.location.pathname === "/top" ? TOP_LOCATION : HOME_LOCATION;
    setLocation(next); setDraft("");
    window.history.replaceState(null, "", navigationHref(next));
  }, []);
  const logout = useMutation({ mutationFn: navigationApi.logout, onMutate: clearPrivate, onSuccess: () => {
    setLoggedOut(true); resetSelection();
    void client.cancelQueries({ queryKey: ["reader-identity"] });
    client.removeQueries({ queryKey: ["reader-identity"] });
    const channel = new window.BroadcastChannel("pinjie-reader"); channel.postMessage("logout"); channel.close();
  } });
  const enabled = !suspended && !logout.isPending;
  const sites = useQuery({ queryKey: [...scope, "sites", location], queryFn: ({ signal }) => navigationApi.sites(location.page, location.search, location.category, location.tag, reader, signal, Boolean(location.top)), initialData: useInitial && sameInitialLocation ? initial?.sites : undefined, enabled: enabled && !home, ...queryPolicy });
  const groups = useQuery({ queryKey: [...scope, "groups", location.page], queryFn: ({ signal }) => navigationApi.groups(location.page, reader, signal), initialData: useInitial && sameInitialLocation ? initial?.groups : undefined, enabled: enabled && home, ...queryPolicy });
  const categories = useQuery({ queryKey: [...scope, "categories"], queryFn: ({ signal }) => navigationApi.categories(reader, signal), initialData: useInitial ? initial?.categories : undefined, enabled, ...queryPolicy });
  const tags = useQuery({ queryKey: ["nav-tags"], queryFn: ({ signal }) => navigationApi.tags(signal), initialData: initial?.tags, ...queryPolicy });
  /** 分类页（含分类+标签双过滤）：用于下拉框展示该分类内有站点的标签 */
  const isOnCategory = !home && !location.search && !!location.category;
  /** 纯标签页（未锁定分类）：用于下拉框展示包含该标签站点的分类 */
  const isOnTagOnly = !home && !location.search && !location.category && !!location.tag;
  const filteredTags = useQuery({ queryKey: [...scope, "tags-in-cat", location.category], queryFn: ({ signal }) => navigationApi.tagsInCategory(location.category, reader, signal), enabled: enabled && isOnCategory, ...queryPolicy });
  const filteredCategories = useQuery({ queryKey: [...scope, "cats-with-tag", location.tag], queryFn: ({ signal }) => navigationApi.categoriesWithTag(location.tag, reader, signal), enabled: enabled && isOnTagOnly, ...queryPolicy });
  const results = home ? groups : sites;
  const filterOptions = isOnCategory ? filteredTags : isOnTagOnly ? filteredCategories : undefined;
  const blocked = suspended || logout.isPending || (reader && (results.isError || categories.isError));
  const siteData = blocked || sites.isError ? undefined : sites.data;
  const groupData = blocked || groups.isError ? undefined : groups.data;
  const categoryData = blocked || categories.isError ? undefined : categories.data;
  const category = categoryData?.find(item => item.id === location.category);
  const tag = tags.data?.find(item => item.id === location.tag);
  const invalidSelection = !home && !location.search && ((!!location.category && categories.isSuccess && !category) || (!!location.tag && tags.isSuccess && !tag));
  const failed = results.isError || categories.isError || tags.isError || Boolean(filterOptions?.isError);
  const loading = blocked || results.isPending || categories.isPending || tags.isPending || Boolean(filterOptions?.isPending);
  const title = home ? "全部站点" : location.top ? "置顶站点" : location.search ? "搜索结果" : category?.name ?? tag?.name ?? "站点列表";
  const loginHref = location.top ? "/api/navigation/start?return_to=/top" : "/api/navigation/start";

  useEffect(() => {
    if (lastReader.current && !reader) { clearPrivate(); resetSelection(); }
    lastReader.current = reader;
  }, [reader, clearPrivate, resetSelection]);
  useEffect(() => {
    if (focusResults.current) { heading.current?.focus(); focusResults.current = false; }
  }, [location]);
  useEffect(() => {
    const back = () => {
      closeDetail(); setDrawer(false); setInitialAvailable(false);
      const next = navigationLocation(new globalThis.URLSearchParams(window.location.search), window.location.pathname);
      setLocation(next); setDraft(next.search); focusResults.current = true;
    };
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, [closeDetail]);
  useEffect(() => {
    const expire = () => { setBlockedAt(Date.now()); clearPrivate(); };
    const visibility = () => {
      setVisible(document.visibilityState === "visible");
      if (document.visibilityState !== "visible") clearPrivate();
      else void client.invalidateQueries({ queryKey: ["reader-identity"] });
    };
    const channel = new window.BroadcastChannel("pinjie-reader");
    channel.onmessage = () => { expire(); setLoggedOut(true); resetSelection(); void client.cancelQueries({ queryKey: ["reader-identity"] }); client.removeQueries({ queryKey: ["reader-identity"] }); };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pinjie:reader-expired", expire);
    return () => { channel.close(); document.removeEventListener("visibilitychange", visibility); window.removeEventListener("pinjie:reader-expired", expire); };
  }, [client, clearPrivate, resetSelection]);
  useEffect(() => {
    if (!loggedOut && autoLogin && !loginResult && !probed.current && identity.error instanceof ApiError && identity.error.status === 401) {
      probed.current = true;
      window.location.replace(`${loginHref}${location.top ? "&" : "?"}silent=1`);
    }
  }, [autoLogin, loginResult, identity.error, loggedOut, loginHref, location.top]);
  const sidebarProps = { profile, categories: categoryData ?? [], tags: tags.data ?? [], location, onNavigate: navigate, showTop: !reader };
  const closeDrawer = useCallback(() => setDrawer(false), []);
  const retry = () => { void results.refetch(); void categories.refetch(); void tags.refetch(); if (filterOptions) void filterOptions.refetch(); };

  return <main className="nav-shell">
    <header className="nav-header"><div className="nav-header-brand"><span className="nav-menu-toggle"><IconButton title="打开分类菜单" aria-expanded={drawer} onClick={() => setDrawer(true)}><Menu size={22} /></IconButton></span><SiteBrand profile={profile} /></div>
      <div className="nav-session">{reader ? <>
        <NavigationLink location={TOP_LOCATION} onNavigate={navigate} className="nav-header-top-link" aria-current={location.top ? "page" : undefined} aria-label="置顶站点" title="置顶站点">
          <Pin size={15} aria-hidden="true" />
          <span>置顶站点</span>
        </NavigationLink>
        <span title={identity.data.display_name}>{identity.data.display_name}</span>
        <IconButton title="退出登录" disabled={logout.isPending} onClick={() => logout.mutate()}><LogOut size={18} /></IconButton>
      </> : <a href={loginHref}><LogIn size={17} /><span>管理员登录</span></a>}</div>
    </header>
    <form className="nav-search" role="search" onSubmit={event => { event.preventDefault(); navigate({ ...HOME_LOCATION, search: draft.trim() }); }}>
      <Search size={17} aria-hidden="true" /><input type="search" aria-label="搜索站点名称或域名" placeholder="搜索站点名称或域名" maxLength={100} enterKeyHint="search" value={draft} onChange={event => setDraft(event.target.value)} />
      {draft && <IconButton title="清除搜索" onClick={() => navigate(HOME_LOCATION)}><X size={16} /></IconButton>}
      <IconButton type="submit" title="搜索"><ArrowRight size={16} /></IconButton>
    </form>
    <aside className="nav-sidebar"><SidebarContent {...sidebarProps} /></aside>
    <section className="nav-results" aria-labelledby="nav-heading">
      <h1 ref={heading} tabIndex={-1} id="nav-heading" className={!home && location.search ? "nav-list-heading" : "nav-visually-hidden"}>{title}</h1>
      {(logout.isError || loginResult === "failed") && <p className="form-alert" role="alert">{logout.isError ? errorMessage(logout.error) : "管理员登录未完成，请重新登录"}</p>}
      {identity.isError && !(identity.error instanceof ApiError && identity.error.status === 401) && <p className="form-alert" role="alert">{errorMessage(identity.error)}</p>}
      {!home && <div className="nav-results-bar">
        {location.search
          ? <div className="nav-results-bar-info"><span>{siteData ? `${siteData.total} 个站点` : "站点"}</span><span className="nav-search-term">"{location.search}"</span><NavigationLink location={HOME_LOCATION} onNavigate={navigate}>清除搜索</NavigationLink></div>
          : <><span className="nav-results-bar-title">{title}</span><div className="nav-results-bar-right"><span className="nav-results-bar-count">{siteData ? `${siteData.total} 个站点` : ""}</span>
            {isOnCategory && <div className="nav-select-wrap"><select aria-label="按标签筛选" disabled={loading || failed} value={location.tag} onChange={event => navigate({ ...location, page: 1, tag: event.target.value })}><option value="">{filteredTags.isPending ? "正在加载标签" : "全部标签"}</option>{!blocked && !filteredTags.isError && filteredTags.data?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>}
            {isOnTagOnly && <div className="nav-select-wrap"><select aria-label="按分类筛选" disabled={loading || failed} value={location.category} onChange={event => navigate({ ...location, page: 1, category: event.target.value })}><option value="">{filteredCategories.isPending ? "正在加载分类" : "全部分类"}</option>{!blocked && !filteredCategories.isError && filteredCategories.data?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>}
            <NavigationLink location={HOME_LOCATION} onNavigate={navigate}>{location.top ? "全部站点" : "清除筛选"}</NavigationLink>
          </div></>}
      </div>}
      {failed || invalidSelection ? <div className="nav-empty" role="alert"><p>{invalidSelection ? "分类或标签不存在或不可见" : errorMessage(results.error ?? categories.error ?? tags.error ?? filterOptions?.error) || initialError}</p><button className="secondary-action" onClick={retry}><RefreshCw size={16} />重新加载</button><NavigationLink location={HOME_LOCATION} onNavigate={navigate}>返回全部站点</NavigationLink></div>
        : loading ? <div className="nav-grid nav-grid-skeleton" role="status" aria-label="正在加载站点">{Array.from({ length: 8 }, (_, index) => <div key={index}><span /><span /><span /></div>)}</div>
          : home ? groupData?.items.length ? groupData.items.map(group => <section className="nav-group" key={group.category.id} aria-labelledby={`group-${group.category.id}`}>
            <header><div><h2 id={`group-${group.category.id}`}>{group.category.name}</h2><span>{group.total}</span></div><NavigationLink location={{ ...HOME_LOCATION, category: group.category.id }} onNavigate={navigate} aria-label={`查看全部${group.category.name}站点`}>查看全部<ArrowRight size={15} /></NavigationLink></header>
            <div className="nav-grid">{group.items.map(site => <SiteCard key={site.id} site={site} onOpen={item => setDetailId(item.id)} />)}</div>
          </section>) : <div className="nav-empty"><Globe size={32} /><p>暂无已发布站点</p></div>
            : siteData?.items.length ? <div className="nav-grid">{siteData.items.map(site => <SiteCard key={site.id} site={site} onOpen={item => setDetailId(item.id)} />)}</div> : <div className="nav-empty"><Globe size={32} /><p>{location.top ? "暂无可见的置顶站点，可在后台编辑站点并开启置顶" : category && !location.tag ? "当前分类暂无站点" : "没有符合条件的站点"}</p></div>}
      {!failed && !invalidSelection && !loading && <nav className="nav-pagination" aria-label={home ? "分类分组分页" : "站点分页"}>
        <IconButton title="上一页" disabled={location.page <= 1 || results.isFetching} onClick={() => navigate({ ...location, page: location.page - 1 })}><ArrowLeft size={18} /></IconButton>
        <span>{location.page} / {Math.max(1, results.data?.total_pages ?? 1)}</span>
        <IconButton title="下一页" disabled={location.page >= (results.data?.total_pages ?? 1) || results.isFetching} onClick={() => navigate({ ...location, page: location.page + 1 })}><ArrowRight size={18} /></IconButton>
      </nav>}
    </section>
    {drawer && <NavigationDrawer {...sidebarProps} onClose={closeDrawer} />}
    {detailId && visible && <SiteDetail key={`${scope.join(":")}:${detailId}`} siteId={detailId} reader={reader} scope={scope} suspended={blocked || (reader && identity.isFetching)} onClose={closeDetail} onNavigate={navigate} />}
  </main>;
}
