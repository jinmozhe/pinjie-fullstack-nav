import { render, screen, waitFor } from "@testing-library/react";
import { ApiError } from "@/lib/api/http";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  me: vi.fn(),
  readerConfig: vi.fn(),
  authorize: vi.fn(),
  callbackOrigin: vi.fn(() => "https://reader.example.com"),
}));

vi.mock("@/lib/api/admin", () => ({ adminApi: { me: mocks.me } }));
vi.mock("@/lib/api/navigation", () => ({ navigationApi: { readerConfig: mocks.readerConfig, authorize: mocks.authorize } }));
vi.mock("@/lib/navigation-callback", () => ({ navigationCallbackOrigin: mocks.callbackOrigin }));

import AuthorizePage from "./AuthorizePage";

const realWindow = window;
const locationReplace = vi.fn();
vi.stubGlobal("window", new Proxy(realWindow, {
  get(target, property) {
    if (property === "location") {
      return {
        get pathname() { return target.location.pathname; },
        get search() { return target.location.search; },
        replace: locationReplace,
      };
    }
    return Reflect.get(target, property);
  },
}));

function setQuery(query: string) {
  window.history.replaceState({}, "", `/navigation/authorize${query}`);
}

describe("AuthorizePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    realWindow.history.replaceState({}, "", "/navigation/authorize");
  });

  it("redirects unauthenticated interactive requests to login", async () => {
    setQuery("?state=s1&challenge=c1&redirect_uri=https%3A%2F%2Freader.example.com%2Fcallback");
    mocks.readerConfig.mockResolvedValue({ callback_urls: ["https://reader.example.com/callback"] });
    mocks.me.mockRejectedValue(new ApiError(401, "AUTH_REQUIRED", "需要登录"));

    render(<AuthorizePage />);
    await waitFor(() => expect(locationReplace).toHaveBeenCalledWith(expect.stringContaining("/login?redirect=")));
    expect(mocks.authorize).not.toHaveBeenCalled();
  });

  it("returns login_required for silent requests", async () => {
    setQuery("?state=s2&challenge=c2&silent=1&redirect_uri=https%3A%2F%2Freader.example.com%2Fcallback");
    mocks.readerConfig.mockResolvedValue({ callback_urls: ["https://reader.example.com/callback"] });
    mocks.me.mockRejectedValue(new ApiError(401, "AUTH_REQUIRED", "需要登录"));

    render(<AuthorizePage />);
    await waitFor(() => expect(locationReplace).toHaveBeenCalledWith(expect.stringContaining("error=login_required")));
  });

  it("authorizes an authenticated request and returns its code", async () => {
    setQuery("?state=s3&challenge=c3&redirect_uri=https%3A%2F%2Freader.example.com%2Fcallback");
    mocks.readerConfig.mockResolvedValue({ callback_urls: ["https://reader.example.com/callback"] });
    mocks.me.mockResolvedValue({ id: "admin" });
    mocks.authorize.mockResolvedValue({ code: "auth-code" });

    render(<AuthorizePage />);
    await waitFor(() => expect(locationReplace).toHaveBeenCalledWith(expect.stringContaining("code=auth-code")));
    expect(mocks.authorize).toHaveBeenCalledWith({ state: "s3", challenge: "c3", redirect_uri: "https://reader.example.com/callback" });
  });

  it("returns access_denied for silent authorization failures and shows other errors", async () => {
    setQuery("?state=s4&challenge=c4&silent=1&redirect_uri=https%3A%2F%2Freader.example.com%2Fcallback");
    mocks.readerConfig.mockResolvedValue({ callback_urls: ["https://reader.example.com/callback"] });
    mocks.me.mockResolvedValue({ id: "admin" });
    mocks.authorize.mockRejectedValueOnce(new ApiError(403, "ACCESS_DENIED", "无权访问"));
    render(<AuthorizePage />);
    await waitFor(() => expect(locationReplace).toHaveBeenCalledWith(expect.stringContaining("error=access_denied")));

    setQuery("?state=s5&challenge=c5&redirect_uri=https%3A%2F%2Freader.example.com%2Fcallback");
    mocks.authorize.mockRejectedValueOnce(new ApiError(500, "SERVER_ERROR", "授权服务失败"));
    render(<AuthorizePage />);
    expect(await screen.findByText("授权服务失败")).toBeInTheDocument();
  });
});
