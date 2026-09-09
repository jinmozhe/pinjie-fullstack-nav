import type { Metadata } from "next";
import { Navigation } from "@/features/navigation";
import { fetchNavigation } from "@/lib/api/navigation-server";
import { fetchSiteProfile } from "@/lib/api/server";
import { shouldProbeReader } from "@/lib/navigation-auth";
import { navigationLocation } from "@/lib/navigation-location";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "置顶站点",
  description: "常用站点，一处直达。浏览已置顶的网站与在线工具。",
  alternates: { canonical: "/top" },
};

export default async function TopPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [profile, autoLogin, params] = await Promise.all([fetchSiteProfile(), shouldProbeReader(), searchParams]);
  const query = new globalThis.URLSearchParams();
  if (typeof params.page === "string") query.set("page", params.page);
  const location = navigationLocation(query, "/top");
  let initial: Awaited<ReturnType<typeof fetchNavigation>> | undefined;
  let initialError: string | undefined;
  try { initial = await fetchNavigation(location); } catch { initialError = "置顶站点暂不可用，请重试"; }
  return <Navigation profile={profile} autoLogin={autoLogin} initial={initial} initialLocation={location} initialError={initialError} loginResult={typeof params.nav_login === "string" ? params.nav_login : undefined} />;
}
