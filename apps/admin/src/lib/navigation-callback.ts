export function navigationCallbackOrigin(callbackUrls: readonly string[], requestedUri: string): string {
  const configuredUri = callbackUrls.find((candidate) => candidate === requestedUri);
  if (!configuredUri) throw new Error("Web 回调地址未配置或不匹配");

  const callback = new globalThis.URL(configuredUri);
  if (
    !["http:", "https:"].includes(callback.protocol)
    || callback.username
    || callback.password
    || callback.pathname !== "/navigation/callback"
    || callback.search
    || callback.hash
  ) {
    throw new Error("Web 回调地址格式不合法");
  }
  return callback.origin;
}
