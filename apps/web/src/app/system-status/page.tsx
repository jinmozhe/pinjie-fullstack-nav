import {
  fetchAuthenticationState,
  fetchInitialSystemStatus,
  fetchRegistrationState,
  fetchSiteProfile,
} from "@/lib/api/server";

import { SystemStatusCard } from "@/features/system/SystemStatusCard";
import { ArrowRight, LogIn, UserRoundPlus } from "lucide-react";
import Link from "next/link";
import { SiteBrand } from "@/features/site";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [status, authenticationState, registrationState, site] = await Promise.all([
    fetchInitialSystemStatus(),
    fetchAuthenticationState(),
    fetchRegistrationState(),
    fetchSiteProfile(),
  ]);
  return (
    <main className="home-shell">
      <header className="home-header"><SiteBrand profile={site} /><Link href="/account">用户中心 <ArrowRight size={16} /></Link></header>
      <section className="home-main" aria-labelledby="home-title">
        <div className="home-intro"><p className="kicker">WELCOME</p><h1 id="home-title">{site.title}</h1><p>{site.description}</p>{authenticationState !== "authenticated" && <div className="home-actions"><Link className="primary-action" href="/login"><LogIn size={18} />登录</Link>{registrationState === "enabled" && <Link className="secondary-action" href="/register"><UserRoundPlus size={18} />创建账户</Link>}</div>}</div>
        <SystemStatusCard initialStatus={status} />
      </section>
    </main>
  );
}
