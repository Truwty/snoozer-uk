import { isMaintenanceExempt } from "@/lib/maintenance-routes";
import { domainName, domainRoute } from "@/lib/domains";
import { domainHostHeader, domainUserHeader } from "@/lib/domain-context";
import { refreshDomain } from "@/lib/domains-server";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { siteUrl, supabaseKey, supabaseUrl } from "@/lib/env";
import { anonymousClient } from "@/lib/supabase";
import { activeAccountCookie, accountListCookie, readSavedAccounts, selectedAccountSlot, sessionStorageName, sessionMaxAge, isSessionCookieName } from "@/lib/account-sessions";
import { canonicalUsername, username } from "@/lib/profile";

const topLevelPages = new Set(["sign-in", "sign-up", "help", "forgot-password", "reset-password", "studio", "templates", "store", "profile-not-found", "privacy", "terms", "leaderboard", "discover", "pricing", "legal", "owner", "appeal", "report", "account-restricted", "maintenance"]);
// Creator marketplace removed. Keep Snoozer-owned Premium subscriptions under /studio/plan
// and /api/v1/billing intact. Historical test-purchase records are retained, but provider-side recovery
// is intentionally disabled. Never reopen seller onboarding.
const retiredCreatorRoutePrefixes = [
  "/store",
  "/studio/products",
  "/studio/memberships",
  "/studio/product-reports",
  "/studio/donations",
  "/studio/purchases",
  "/studio/support",
  "/api/v1/commerce",
] as const;

export function isRetiredCreatorRoute(pathname: string) {
  return retiredCreatorRoutePrefixes.some(prefix => pathname === prefix || pathname.startsWith(prefix + "/"));
}


export async function proxy(request: NextRequest) {
  if (isRetiredCreatorRoute(request.nextUrl.pathname)) {
    return new NextResponse("Not found.", { status: 404, headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    } });
  }
  const pathname = request.nextUrl.pathname;
  const localTestHost = ["localhost", "127.0.0.1"].includes(request.nextUrl.hostname);
  if (!localTestHost && (pathname === "/status" || pathname === "/status/")) {
    return NextResponse.redirect(new URL("https://status.snoozer.uk/"), { status: 308 });
  }
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const development = process.env.NODE_ENV === "development";
  const plainTextPaste = /^\/paste\/[^/]+\/?$/.test(request.nextUrl.pathname);
  const storage = supabaseUrl ? new URL(supabaseUrl).origin : "";
  const csp = plainTextPaste ? "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; sandbox" : [
    "default-src 'self'", "object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'",
    "form-action 'self'", `script-src 'self' 'nonce-${nonce}'${development ? " 'unsafe-eval'" : ""}`,
    `script-src-elem 'self' 'nonce-${nonce}'`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob: https://images.unsplash.com", "font-src 'self'", "media-src 'self' https: blob:",
    "frame-src https://www.youtube-nocookie.com https://player.twitch.tv https://open.spotify.com",
    `connect-src 'self' ${storage}`, ...(siteUrl().protocol === "https:" ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
  const headers = new Headers(request.headers);
  // Next.js reads the request nonce when emitting framework and route scripts.
  // Keep it on the internal request only; do not expose the nonce as a response header.
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  headers.delete(domainHostHeader); headers.delete(domainUserHeader);
  const host = (request.headers.get("host") ?? request.nextUrl.host).toLowerCase();
  if (!isMaintenanceExempt(request.nextUrl.pathname, request.method) && supabaseUrl && supabaseKey) {
    // A provider outage must never make the Owner recovery route inaccessible.
    // A transient RPC failure fails open, while a confirmed maintenance flag
    // rewrites public pages to a real 503 (never caches successful content).
    const status = await anonymousClient().rpc("platform_maintenance_enabled");
    if (!status.error && status.data === true) {
      const unavailable = NextResponse.rewrite(new URL("/maintenance", request.url), {
        status: 503, request: { headers },
      });
      unavailable.headers.set("Content-Security-Policy", csp);
      unavailable.headers.set("X-Content-Type-Options", "nosniff");
      unavailable.headers.set("Referrer-Policy", "no-referrer");
      unavailable.headers.set("Cache-Control", "private, no-store");
      unavailable.headers.set("Retry-After", "300");
      return unavailable;
    }
  }
  const deploymentAlias = host !== siteUrl().host.toLowerCase() && host === process.env.RENDER_EXTERNAL_HOSTNAME?.toLowerCase();
  const custom = host !== siteUrl().host.toLowerCase() && !deploymentAlias;
  let domainTarget: string | undefined;
  let domainFailure: 404 | 503 | undefined;
  const marker = request.nextUrl.pathname === "/.well-known/snoozer-domain" && ["GET", "HEAD"].includes(request.method);
  let canonicalTarget: URL | undefined;
  if (deploymentAlias && ["GET", "HEAD"].includes(request.method) && !request.nextUrl.pathname.startsWith("/api/") && !marker) {
    canonicalTarget = siteUrl();
    canonicalTarget.pathname = request.nextUrl.pathname;
    canonicalTarget.search = request.nextUrl.search;
  }
  if (custom && !marker) {
    if (!domainName.safeParse(host).success || !supabaseUrl || !supabaseKey) domainFailure = 404;
    else {
      let lookup = await anonymousClient().rpc("resolve_profile_domain", { p_host: host });
      if (!lookup.error && lookup.data?.state === "expired") {
        await refreshDomain(host);
        lookup = await anonymousClient().rpc("resolve_profile_domain", { p_host: host });
      }
      const name = username.safeParse(lookup.data?.username);
      if (lookup.error) domainFailure = 503;
      else if (lookup.data === null) domainFailure = 404;
      else if (lookup.data?.state !== "ready" || !name.success) domainFailure = 503;
      else if (request.headers.has("next-action") || !domainRoute(request.nextUrl.pathname, request.method, name.data)) domainFailure = 404;
      else {
        headers.set(domainHostHeader, host); headers.set(domainUserHeader, name.data);
        if (request.nextUrl.pathname === "/") domainTarget = name.data;
      }
    }
  }
  // A deployment without Supabase credentials cannot authenticate anyone.
  // Fail closed before protected Server Components try to construct a client.
  const protectedPage = request.nextUrl.pathname === "/studio"
    || request.nextUrl.pathname.startsWith("/studio/")
    || request.nextUrl.pathname === "/owner"
    || request.nextUrl.pathname.startsWith("/owner/")
    || request.nextUrl.pathname === "/account-restricted"
    || request.nextUrl.pathname === "/account/data"
    || request.nextUrl.pathname === "/account/notifications";
  if (!custom && protectedPage && (!supabaseUrl || !supabaseKey)) {
    const next = request.nextUrl.pathname + request.nextUrl.search;
    const signIn = new URL("/sign-in", request.url);
    signIn.searchParams.set("next", next);
    const response = NextResponse.redirect(signIn);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Content-Type-Options", "nosniff");
    return response;
  }
  const slug = request.nextUrl.pathname.match(/^\/([a-zA-Z0-9-]+)\/?$/)?.[1];
  let missing = false;
  let destination: URL | undefined;
  let redirectStatus: 307 | 308 = 307;
  if (!custom && !canonicalTarget && slug && !topLevelPages.has(slug) && username.safeParse(canonicalUsername(slug)).success
    && supabaseUrl && supabaseKey && ["GET", "HEAD"].includes(request.method)) {
    // Next's async dynamic notFound fallback can be blank without JavaScript.
    const { data, error } = await anonymousClient().rpc("resolve_public_address", { p_name: canonicalUsername(slug) });
    missing = !error && data === null;
    const target = username.safeParse(data);
    if (!error && target.success && target.data !== slug) {
      destination = new URL(`/${target.data}`, siteUrl());
      destination.search = request.nextUrl.search;
      redirectStatus = target.data === canonicalUsername(slug) ? 308 : 307;
    }
  }
  const response = canonicalTarget ? NextResponse.redirect(canonicalTarget, { status: 308 })
    : domainFailure ? new NextResponse(domainFailure === 503 ? "This profile domain is temporarily unavailable." : "Page not found.", { status: domainFailure })
    : domainTarget ? NextResponse.rewrite(new URL(`/${domainTarget}${request.nextUrl.search}`, request.url), { request: { headers } })
    : destination ? NextResponse.redirect(destination, { status: redirectStatus }) : missing
    ? NextResponse.rewrite(new URL("/profile-not-found", request.url), { status: 404, request: { headers } })
    : NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (siteUrl().protocol === "https:") response.headers.set("Strict-Transport-Security", "max-age=31536000");

  // Refresh server-cookie sessions on site navigation, not just Studio pages.
  // Otherwise an idle tab can appear signed out even while a valid refresh
  // token is stored. Public profile/media/API requests don't need a refresh.
  const sessionPage = !request.nextUrl.pathname.startsWith("/api/")
    && !request.nextUrl.pathname.startsWith("/media/")
    && !request.nextUrl.pathname.startsWith("/auth/callback")
    && !request.nextUrl.pathname.startsWith("/auth/confirm");
  if (!custom && !canonicalTarget && sessionPage && supabaseUrl && supabaseKey) {
    const accounts = readSavedAccounts(request.cookies.get(accountListCookie)?.value);
    const slot = selectedAccountSlot(request.cookies.get(activeAccountCookie)?.value, accounts);
    const name = sessionStorageName(slot);
    const hasSession = request.cookies.getAll().some(({ name: cookie }) =>
      isSessionCookieName(cookie, name));
    if (hasSession) {
    const client = createServerClient(supabaseUrl, supabaseKey, {
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8000) }) },
      cookieOptions: { httpOnly: true, sameSite: "lax", secure: siteUrl().protocol === "https:", path: "/", maxAge: sessionMaxAge, ...(name ? { name } : {}) },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (values) => {
          for (const { name, value, options } of values) {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          }
          // Next forwards these overrides to the downstream Server Component/action.
          response.headers.set("x-middleware-request-cookie", request.headers.get("cookie") ?? "");
          const overrides = response.headers.get("x-middleware-override-headers");
          if (!overrides?.split(",").includes("cookie")) {
            response.headers.set("x-middleware-override-headers", [overrides, "cookie"].filter(Boolean).join(","));
          }
        },
      },
    });
    await client.auth.getUser();
    }
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|health/).*)"],
};
