export function widgetVisitorToken() {
  const key = "snoozer-profile-widgets-visitor-v1";
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
