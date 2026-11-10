import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { siteUrl, supabaseKey, supabaseUrl } from "@/lib/env";

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const development = process.env.NODE_ENV === "development";
  const storage = supabaseUrl ? new URL(supabaseUrl).origin : "";
  const csp = [
    "default-src 'self'", "object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'",
    "form-action 'self'", `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", "font-src 'self'",
    `connect-src 'self' ${storage}`, ...(siteUrl().protocol === "https:" ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
  const headers = new Headers(request.headers);
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (siteUrl().protocol === "https:") response.headers.set("Strict-Transport-Security", "max-age=31536000");

  if (request.nextUrl.pathname.startsWith("/studio") && supabaseUrl && supabaseKey) {
    const client = createServerClient(supabaseUrl, supabaseKey, {
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8000) }) },
      cookieOptions: { httpOnly: true, sameSite: "lax", secure: siteUrl().protocol === "https:" },
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
    if (request.cookies.getAll().some(({ name }) => name.startsWith("sb-"))) await client.auth.getUser();
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|health/).*)"],
};
