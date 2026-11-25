import { NextResponse } from "next/server";
import { siteUrl, supabaseKey, supabaseUrl } from "@/lib/env";
import { sessionClientForSlot } from "@/lib/supabase";
import { cookies } from "next/headers";
import { chooseAccount, clearPending, pendingSlot, saveAccount, storedAccounts } from "@/lib/account-session-server";
import { z } from "zod";
import { safeNextPath } from "@/lib/account-security";

// This route receives provider codes after Google or Discord returns to Supabase.
// Supabase's PKCE verifier lives in the HTTP-only cookie created when login began.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const presenceFlow = url.searchParams.get("flow") === "discord-presence";
  const googleLinkFlow = url.searchParams.get("flow") === "google-link";
  const googleLoginFlow = url.searchParams.get("flow") === "google-login";
  const next = safeNextPath(url.searchParams.get("next"));
  const profile = z.uuid().safeParse(url.searchParams.get("profile"));
  const presenceTarget = new URL("/studio/discord", siteUrl());
  if (presenceFlow && profile.success) presenceTarget.searchParams.set("profile", profile.data);
  const failed = async () => {
    try { clearPending(await cookies()); } catch { /* No pending session to clear. */ }
    if (googleLinkFlow) return NextResponse.redirect(new URL("/studio/account?google=failed", siteUrl()), 303);
    if (googleLoginFlow) return NextResponse.redirect(new URL("/sign-in?google=failed", siteUrl()), 303);
    if (presenceFlow) {
      const target = new URL(presenceTarget);
      target.searchParams.set("error", "link");
      return NextResponse.redirect(target, 303);
    }
    return NextResponse.redirect(new URL("/sign-in?discord=failed", siteUrl()), 303);
  };

  if (!code || !supabaseUrl || !supabaseKey) return failed();

  try {
    const jar = await cookies();
    const slot = pendingSlot(jar);
    if (!slot) return failed();
    const client = await sessionClientForSlot(slot);
    let activeClient = client;
    const expected = googleLinkFlow ? storedAccounts(jar).find((entry) => entry.slot === slot) : null;
    const before = googleLinkFlow ? await client.auth.getUser() : null;
    if (googleLinkFlow && (!expected?.userId || before?.data.user?.id !== expected.userId)) return failed();
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (error || !data.user?.email_confirmed_at || (googleLinkFlow && data.user.id !== expected?.userId)) {
      if (data.session) await client.auth.signOut({ scope: "local" });
      return failed();
    }
    const existing = googleLinkFlow ? null : storedAccounts(jar).find((entry) => entry.userId === data.user.id && entry.slot !== slot);
    if (existing) {
      await client.auth.signOut({ scope: "local" });
      chooseAccount(jar, existing.slot);
      activeClient = await sessionClientForSlot(existing.slot);
    } else {
      saveAccount(jar, slot, data.user.id, data.user.email);
    }
    clearPending(jar);
    if (presenceFlow) {
      presenceTarget.searchParams.set("linked", "1");
      return NextResponse.redirect(presenceTarget, 303);
    }
    if (googleLinkFlow) {
      await activeClient.rpc("refresh_my_profile_badges");
      return NextResponse.redirect(new URL("/studio/account?google=linked", siteUrl()), 303);
    }
    const assurance = await activeClient.auth.mfa.getAuthenticatorAssuranceLevel();
    const destination = assurance.data?.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2"
      ? "/auth/mfa?next=" + encodeURIComponent(next) : next;
    return NextResponse.redirect(new URL(destination, siteUrl()), 303);
  } catch {
    return failed();
  }
}
