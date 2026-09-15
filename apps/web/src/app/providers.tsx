"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 15_000, refetchInterval: false, refetchOnWindowFocus: false } } }));
  useEffect(() => {
    const expired = () => {
      if (window.location.pathname === "/login") return;
      client.clear();
      router.replace("/login?reason=session-expired");
      router.refresh();
    };
    window.addEventListener("pinjie:session-expired", expired);
    return () => window.removeEventListener("pinjie:session-expired", expired);
  }, [client, router]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
