import { useEffect, useRef, useState } from "react";
import { Alert, Button, Spin } from "antd";
import { adminApi } from "@/lib/api/admin";
import { navigationApi } from "@/lib/api/navigation";
import { ApiError, errorMessage } from "@/lib/api/http";
import { navigationCallbackOrigin } from "@/lib/navigation-callback";

export default function AuthorizePage() {
  const started = useRef(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.search);
    const state = params.get("state") ?? "";
    const challenge = params.get("challenge") ?? "";
    const redirect_uri = params.get("redirect_uri") ?? "";
    // The backend supplies the exact callback allowlist; failures never navigate to caller input.
    const authorize = async () => {
      const config = await navigationApi.readerConfig();
      const callbackOrigin = navigationCallbackOrigin(config.callback_urls, redirect_uri);
      // Only the allowlisted origin and fixed path select the destination; caller data stays in the fragment.
      const returnToWeb = (fragment: Record<string, string>) => {
        window.location.replace(`${callbackOrigin}/navigation/callback#${new URLSearchParams(fragment)}`);
      };
      try {
        await adminApi.me();
      } catch (cause) {
        if (cause instanceof ApiError && cause.status === 401 && params.get("silent") !== "1") {
          window.location.replace(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
          return;
        }
        if (cause instanceof ApiError && cause.status === 401 && params.get("silent") === "1") {
          returnToWeb({ state, error: "login_required" });
          return;
        }
        throw cause;
      }
      let result;
      try { result = await navigationApi.authorize({ state, challenge, redirect_uri }); }
      catch (cause) {
        if (cause instanceof ApiError && cause.status === 403 && params.get("silent") === "1") {
          returnToWeb({ state, error: "access_denied" });
          return;
        }
        throw cause;
      }
      returnToWeb({ state, code: result.code });
    };
    void authorize().catch((cause: unknown) => setError(errorMessage(cause)));
  }, []);
  return <main className="bootstrap-state">{error ? <Alert type="error" showIcon title="导航登录未完成" description={error} action={<Button onClick={() => window.location.reload()}>重试</Button>} /> : <Spin description="正在核验管理员身份" />}</main>;
}
