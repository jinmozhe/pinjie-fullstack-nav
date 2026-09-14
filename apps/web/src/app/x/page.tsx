import type { Metadata } from "next";
import { connection } from "next/server";

import { loadXSites, XNavigation } from "@/features/x-navigation";
import "@/features/navigation/navigation.css";

export const runtime = "nodejs";
export const metadata: Metadata = {
  title: "私密导航",
  robots: "noindex, nofollow",
};

export default async function PrivateNavigationPage() {
  await connection();
  const sites = await loadXSites();
  return <XNavigation sites={sites} />;
}
