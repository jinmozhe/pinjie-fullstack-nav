import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import { Providers } from "./providers";
import { fetchSiteProfile } from "@/lib/api/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const publicOrigin = process.env.WEB_PUBLIC_ORIGIN ?? "http://localhost:3000";
  const site = await fetchSiteProfile();
  return {
    metadataBase: new URL(publicOrigin),
    title: { default: site.title, template: `%s | ${site.name}` },
    description: site.description,
    keywords: site.keywords,
    alternates: { canonical: "/" },
  };
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
