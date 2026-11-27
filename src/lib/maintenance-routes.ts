// Keep billing webhooks, session recovery, Owner administration and legal/support
// access available even when public pages are put into maintenance mode.
export function isMaintenanceExempt(pathname: string, method: string) {
 if (method !== "GET" && method !== "HEAD") return true;
 return ["/api", "/auth", "/owner", "/appeal", "/health", "/media", "/_next"].some(
  prefix => pathname === prefix || pathname.startsWith(prefix + "/")
 ) || ["/maintenance", "/sign-in", "/forgot-password", "/reset-password",
        "/account-restricted", "/account/data", "/account/notifications", "/appeal", "/report", "/legal", "/privacy", "/terms", "/status",
        "/.well-known/snoozer-domain"].includes(pathname);
}

