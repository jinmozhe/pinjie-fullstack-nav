import { describe, expect, it } from "vitest";

import { navigationCallbackOrigin } from "./navigation-callback";

describe("navigation callback destination", () => {
  it.each(["http://localhost:3000", "https://web.example.com"])(
    "accepts the exact configured callback for %s",
    (origin) => {
      const callback = `${origin}/navigation/callback`;
      expect(navigationCallbackOrigin([callback], callback)).toBe(origin);
    },
  );

  it.each([
    "https://other.example.com/navigation/callback",
    "https://web.example.com.attacker.example/navigation/callback",
    "https://web.example.com/navigation/callback?next=https://other.example.com",
    "https://web.example.com/navigation/callback#unexpected",
    "https://web.example.com/navigation/callback/",
  ])("rejects a caller URL outside the exact allowlist: %s", (requestedUri) => {
    expect(() => navigationCallbackOrigin(
      ["https://web.example.com/navigation/callback"], requestedUri,
    )).toThrow("Web 回调地址未配置或不匹配");
  });

  it.each([
    "javascript:alert(1)",
    "ftp://web.example.com/navigation/callback",
    "https://user@web.example.com/navigation/callback",
    "https://web.example.com/other",
    "https://web.example.com/navigation/callback?next=other",
    "https://web.example.com/navigation/callback#unexpected",
  ])("rejects malformed server configuration: %s", (callback) => {
    expect(() => navigationCallbackOrigin([callback], callback)).toThrow("Web 回调地址格式不合法");
  });
});
