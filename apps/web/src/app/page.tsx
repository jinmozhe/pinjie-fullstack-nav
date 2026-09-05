import { Navigation } from "@/features/navigation";
import { fetchNavigation } from "@/lib/api/navigation-server";
import { fetchSiteProfile } from "@/lib/api/server";
import { shouldProbeReader } from "@/lib/navigation-auth";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ nav_login?: string }> }) {
  const [profile, autoLogin, params] = await Promise.all([fetchSiteProfile(), shouldProbeReader(), searchParams]);
  let initial: Awaited<ReturnType<typeof fetchNavigation>> | undefined;
  let initialError: string | undefined;
  try { initial = await fetchNavigation(); } catch { initialError = "导航服务暂不可用，请重试"; }
  return <Navigation profile={profile} autoLogin={autoLogin} initial={initial} initialError={initialError} loginResult={params.nav_login} />;
}
