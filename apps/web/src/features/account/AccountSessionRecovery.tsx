"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { webAuthApi } from "@/features/auth";
import { errorMessage, isSessionError } from "@/lib/api/http";

export function AccountSessionRecovery() {
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState<string>();

  const recover = useCallback(() => {
    void webAuthApi.refresh().then(
      () => router.refresh(),
      (failure: unknown) => {
        if (isSessionError(failure)) {
          router.replace("/login?reason=session-required");
          router.refresh();
        } else {
          setError(errorMessage(failure));
        }
      },
    );
  }, [router]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    recover();
  }, [recover]);

  if (error) {
    return (
      <main className="loading-page">
        <p role="alert">{error}</p>
        <button className="secondary-action compact" type="button" onClick={() => { setError(undefined); recover(); }}>重试</button>
      </main>
    );
  }

  return (
    <main className="loading-page" role="status" aria-live="polite">
      <LoaderCircle aria-hidden="true" />
      <span>正在恢复会话</span>
    </main>
  );
}
