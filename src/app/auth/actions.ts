"use server";

import { referralSignupData } from "@/lib/referrals";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/actions";
import { siteUrl, supabaseKey, supabaseUrl } from "@/lib/env";
import { anonymousClient, sessionClient, sessionClientForSlot } from "@/lib/supabase";
import { cookies } from "next/headers";
import { safeNextPath } from "@/lib/account-security";
import { currentSlot, storedAccounts, saveAccount, markPending, removeAccountFromList, isAtAccountLimit, chooseAccount } from "@/lib/account-session-server";

const email = z.email().max(254);
const newPassword = z.string().min(12).max(72).refine((value) => Buffer.byteLength(value) <= 72);
const tokenHash = z.string().regex(/^[a-zA-Z0-9_-]{32,128}$/);
const error = (message: string): ActionState => ({ status: "error", message });
const success = (message: string): ActionState => ({ status: "success", message });
const unavailable = () => error("Account services are temporarily unavailable. Try again later.");

export async function register(_: ActionState, form: FormData): Promise<ActionState> {
  const address = email.safeParse(form.get("email"));
  const password = newPassword.safeParse(form.get("password"));
  if (!address.success || !password.success) return error("Enter a valid email and a password of 12–72 bytes.");
  if (!supabaseUrl || !supabaseKey) return unavailable();

  const availability = await anonymousClient().rpc("registration_is_enabled");
  if (availability.error || availability.data !== true) return error("Email registration is currently unavailable.");
  const client = await sessionClient();
  const result = await client.auth.signUp({
    email: address.data, password: password.data,
    options: { emailRedirectTo: new URL("/auth/confirm", siteUrl()).href, data: referralSignupData(form.get("referral"), form.get("referral_consent")) },
  });
  if (result.error?.status === 429) return error("Too many requests. Try again later.");
  if ((result.error?.status ?? 0) >= 500) return unavailable();
  if (result.data.session) {
    await client.auth.signOut();
    return unavailable();
  }
  return success("If registration can proceed, you’ll receive a verification link by email.");
}

export async function signIn(_: ActionState, form: FormData): Promise<ActionState> {
  const address = email.safeParse(form.get("email"));
  const password = z.string().min(1).max(256).safeParse(form.get("password"));
  if (!address.success || !password.success) return error("Enter your email and password.");
  if (!supabaseUrl || !supabaseKey) return unavailable();
  const jar = await cookies();
  const adding = form.get("add_account") === "1";
  if (adding && isAtAccountLimit(jar)) return error("You can keep up to four accounts signed in on this browser.");
  const slot = adding ? crypto.randomUUID() : currentSlot(jar);
  const client = await sessionClientForSlot(slot);
  const result = await client.auth.signInWithPassword({ email: address.data, password: password.data });
  if (result.error || !result.data.user?.email_confirmed_at) {
    if (result.data.session) await client.auth.signOut({ scope: "local" });
    if (result.error?.status === 429) return error("Too many attempts. Try again later.");
    return error("Couldn’t sign in. Check your details and make sure you’ve verified your email.");
  }
  // Never retain two refresh-token cookies for the same account.
  const existing = adding && storedAccounts(jar).find((item) => item.userId === result.data.user!.id);
  let activeClient = client;
  if (existing) {
    await client.auth.signOut({ scope: "local" });
    chooseAccount(jar, existing.slot);
    activeClient = await sessionClientForSlot(existing.slot);
  } else {
    saveAccount(jar, slot, result.data.user.id, result.data.user.email);
  }
  const next = safeNextPath(form.get("next"));
  const assurance = await activeClient.auth.mfa.getAuthenticatorAssuranceLevel();
  redirect(assurance.data?.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2"
    ? "/auth/mfa?next=" + encodeURIComponent(next) : next);
}

// OAuth is initiated on the server so Supabase's PKCE verifier is stored in
// its secure session cookie. Do not link users to Discord's raw URL Generator.
export async function signInWithDiscord(form: FormData) {
  if (!supabaseUrl || !supabaseKey) redirect("/sign-in?discord=unavailable");
  const jar = await cookies();
  const adding = form.get("add_account") === "1";
  if (adding && isAtAccountLimit(jar)) redirect("/sign-in?add=1&limit=1");
  const next = safeNextPath(form.get("next"));
  const slot = adding ? crypto.randomUUID() : currentSlot(jar);
  // The callback must use precisely the same cookie namespace for PKCE.
  markPending(jar, slot);
  const client = await sessionClientForSlot(slot);
  const { data, error: authError } = await client.auth.signInWithOAuth({
    provider: "discord",
    options: {
      redirectTo: new URL("/auth/callback?next=" + encodeURIComponent(next), siteUrl()).href,
      scopes: "identify email",
    },
  });
  if (authError || !data.url) redirect("/sign-in?discord=failed");
  redirect(data.url);
}

// Google sign-in uses the same isolated PKCE cookie slot as Discord.
export async function signInWithGoogle(form: FormData) {
  if (!supabaseUrl || !supabaseKey) redirect("/sign-in?google=unavailable");
  const jar = await cookies();
  const adding = form.get("add_account") === "1";
  if (adding && isAtAccountLimit(jar)) redirect("/sign-in?add=1&limit=1");
  const next = safeNextPath(form.get("next"));
  const slot = adding ? crypto.randomUUID() : currentSlot(jar);
  markPending(jar, slot);
  const client = await sessionClientForSlot(slot);
  const { data, error: authError } = await client.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: new URL("/auth/callback?next=" + encodeURIComponent(next), siteUrl()).href },
  });
  if (authError || !data.url) redirect("/sign-in?google=failed");
  redirect(data.url);
}

// Add Google to the currently authenticated Snoozer identity. The callback
// verifies the same user ID before accepting the OAuth result.
export async function linkGoogleIdentity() {
  if (!supabaseUrl || !supabaseKey) redirect("/studio/account?google=unavailable");
  const jar = await cookies();
  const slot = currentSlot(jar);
  const client = await sessionClientForSlot(slot);
  const { data: current } = await client.auth.getUser();
  if (!current.user?.email_confirmed_at) redirect("/sign-in");
  markPending(jar, slot);
  const { data, error: authError } = await client.auth.linkIdentity({
    provider: "google",
    options: { redirectTo: new URL("/auth/callback?flow=google-link", siteUrl()).href },
  });
  if (authError || !data.url) redirect("/studio/account?google=failed");
  redirect(data.url);
}

export async function requestReset(_: ActionState, form: FormData): Promise<ActionState> {
  const address = email.safeParse(form.get("email"));
  if (!address.success) return error("Enter a valid email address.");
  if (!supabaseUrl || !supabaseKey) return unavailable();

  const client = await sessionClient();
  await client.auth.resetPasswordForEmail(address.data, { redirectTo: new URL("/reset-password", siteUrl()).href });
  return success("If the account is eligible, you’ll receive a password reset link by email.");
}

export async function confirmEmail(_: ActionState, form: FormData): Promise<ActionState> {
  const token = tokenHash.safeParse(form.get("token_hash"));
  if (!token.success) return error("This verification link is invalid.");
  if (!supabaseUrl || !supabaseKey) return unavailable();
  const client = await sessionClient();
  const requestedType = form.get("type") === "email_change" ? "email_change" : "email";
  const result = await client.auth.verifyOtp({ type: requestedType, token_hash: token.data });
  if (result.error || !result.data.user?.email_confirmed_at) return error("This verification link has expired or already been used.");
  const jar = await cookies();
  saveAccount(jar, currentSlot(jar), result.data.user.id, result.data.user.email);
  if (requestedType === "email_change") redirect("/studio/account?email=changed");
  if (result.data.user.user_metadata.snoozer_referral_consent === true) {
    const attribution = await client.rpc("accept_my_referral");
    if (attribution.error || !["accepted", "already_recorded"].includes(attribution.data)) redirect("/studio/growth?referral=unconfirmed");
  }
  redirect("/studio");
}

export async function resetPassword(_: ActionState, form: FormData): Promise<ActionState> {
  const token = tokenHash.safeParse(form.get("token_hash"));
  const password = newPassword.safeParse(form.get("password"));
  if (!token.success || !password.success) return error("Use a valid reset link and a password of 12–72 bytes.");
  if (!supabaseUrl || !supabaseKey) return unavailable();

  const client = await sessionClient();
  const verified = await client.auth.verifyOtp({ type: "recovery", token_hash: token.data });
  if (verified.error || !verified.data.session) return error("This reset link has expired or already been used.");
  const updated = await client.auth.updateUser({ password: password.data });
  const revoked = await client.auth.signOut({ scope: "global" });
  if (updated.error) return error("Couldn’t change your password. Request a new reset link and try again.");
  if (revoked.error) return error("Your password changed. Session revocation couldn’t be confirmed.");
  const jar = await cookies();
  removeAccountFromList(jar, currentSlot(jar));
  redirect("/sign-in?reset=1");
}

export async function signOut() {
  const jar = await cookies();
  const slot = currentSlot(jar);
  const client = await sessionClientForSlot(slot);
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) redirect("/studio?logout=failed");
  removeAccountFromList(jar, slot);
  redirect("/");
}
