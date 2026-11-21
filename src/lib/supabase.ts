import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { siteUrl, supabaseConfig } from "./env";
import { sessionMaxAge, sessionStorageName } from "./account-sessions";
import { currentSlot } from "./account-session-server";

const options = {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  global: {
    fetch: (input: RequestInfo | URL, init?: RequestInit) =>
      fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(8000) }),
  },
};

export function anonymousClient() {
  const { url, key } = supabaseConfig();
  return createClient(url, key, options);
}

export function storageAdmin() {
  const { url } = supabaseConfig();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Media storage is not configured.");
  return createClient(url, key, options);
}

export async function sessionClientForSlot(slot: string) {
  const { url, key } = supabaseConfig();
  const jar = await cookies();
  const name = sessionStorageName(slot);
  return createServerClient(url, key, {
    global: options.global,
    // 1 year of inactivity is the browser's cookie cap; each authenticated
    // request refreshes cookies. Server-side revocation still takes precedence.
    cookieOptions: {
      httpOnly: true, sameSite: "lax", secure: siteUrl().protocol === "https:",
      path: "/", maxAge: sessionMaxAge,
      ...(name ? { name } : {}),
    },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (values) => {
        try {
          for (const { name, value, options } of values) jar.set(name, value, options);
        } catch {
          // Server Components are read-only. The proxy persists refreshed cookies.
        }
      },
    },
  });
}

export async function sessionClient() {
  const jar = await cookies();
  return sessionClientForSlot(currentSlot(jar));
}
