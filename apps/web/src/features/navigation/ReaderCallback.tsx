"use client";

import { useEffect, useRef } from "react";
import { webRequest } from "@/lib/api/http";

export function ReaderCallback() {
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new globalThis.URLSearchParams(window.location.hash.slice(1));
    window.history.replaceState(null, "", "/navigation/callback");
    const payload = { state: params.get("state"), code: params.get("code"), error: params.get("error") };
    void webRequest<null>("/api/navigation/callback", { method: "POST", body: JSON.stringify(payload), cache: "no-store" }, false)
      .then(() => window.location.replace(payload.error ? "/?nav_login=anonymous" : "/"))
      .catch(() => window.location.replace("/?nav_login=failed"));
  }, []);
  return <main className="nav-shell"><p role="status">正在完成管理员登录…</p></main>;
}
