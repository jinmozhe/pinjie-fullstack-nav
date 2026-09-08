import { Navigation } from "@/features/navigation";
import { fetchNavigation } from "@/lib/api/navigation-server";
import { fetchSiteProfile } from "@/lib/api/server";
import { shouldProbeReader } from "@/lib/navigation-auth";
import { navigationLocation } from "@/lib/navigation-location";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [profile, autoLogin, params] = await Promise.all([fetchSiteProfile(), shouldProbeReader(), searchParams]);
  let initial: Awaited<ReturnType<typeof fetchNavigation>> | undefined;
  let initialError: string | undefined;
  const query = new globalThis.URLSearchParams();
  for (const key of ["search", "category", "tag", "page"]) {
    const value = params[key];
    if (typeof value === "string") query.set(key, value);
  }
  const location = navigationLocation(query);
  try { initial = await fetchNavigation(location); } catch { initialError = "导航服务暂不可用，请重试"; }
  return <Navigation profile={profile} autoLogin={autoLogin} initial={initial} initialLocation={location} initialError={initialError} loginResult={typeof params.nav_login === "string" ? params.nav_login : undefined} />;
}
