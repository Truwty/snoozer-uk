import { NextResponse } from "next/server";
import { siteUrl, supabaseKey, supabaseUrl } from "@/lib/env";
import { sessionClientForSlot } from "@/lib/supabase";
import { cookies } from "next/headers";
import { chooseAccount, clearPending, pendingSlot, saveAccount, storedAccounts } from "@/lib/account-session-server";

// This route receives the code AFTER Discord has returned it to Supabase.
// Supabase's PKCE verifier lives in the HTTP-only cookie created when login began.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const failed = () => NextResponse.redirect(new URL("/sign-in?discord=failed", siteUrl()), 303);

  if (!code || !supabaseUrl || !supabaseKey) return failed();

  try {
    const jar = await cookies();
    const slot = pendingSlot(jar);
    if (!slot) return failed();
    const client = await sessionClientForSlot(slot);
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (error || !data.user?.email_confirmed_at) {
      if (data.session) await client.auth.signOut({ scope: "local" });
      return failed();
    }
    const existing = storedAccounts(jar).find((entry) => entry.userId === data.user.id && entry.slot !== slot);
    if (existing) {
      await client.auth.signOut({ scope: "local" });
      chooseAccount(jar, existing.slot);
    } else {
      saveAccount(jar, slot, data.user.id, data.user.email);
    }
    clearPending(jar);
    return NextResponse.redirect(new URL("/studio", siteUrl()), 303);
  } catch {
    return failed();
  }
}
