export function safeNextPath(value: unknown, fallback = "/studio") {
  if (typeof value !== "string" || value.length > 300 || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\r\n]/.test(value)) return fallback;
  try { const parsed = new URL(value, "https://snoozer.invalid"); return parsed.origin === "https://snoozer.invalid" ? parsed.pathname + parsed.search + parsed.hash : fallback; }
  catch { return fallback; }
}

export function deviceLabel(userAgent: string | null | undefined) {
  const value = (userAgent ?? "").slice(0, 600);
  const browser = /Edg\//.test(value) ? "Edge" : /Firefox\//.test(value) ? "Firefox" : /Chrome\//.test(value) ? "Chrome" : /Safari\//.test(value) && !/Chrome\//.test(value) ? "Safari" : /Opera|OPR\//.test(value) ? "Opera" : "Unknown browser";
  const platform = /Windows NT/.test(value) ? "Windows" : /Mac OS X/.test(value) ? "macOS" : /Android/.test(value) ? "Android" : /iPhone|iPad|iPod/.test(value) ? "iOS" : /Linux/.test(value) ? "Linux" : "Unknown device";
  return browser + " · " + platform;
}
