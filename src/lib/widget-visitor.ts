export function widgetVisitorToken(scope: string) {
  const key = "snoozer-profile-widget-visitor-v1:" + scope;
  try {
    const existing = window.localStorage.getItem(key);
    if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
    const created = window.crypto.randomUUID();
    window.localStorage.setItem(key, created);
    return created;
  } catch {
    return window.crypto.randomUUID();
  }
}
