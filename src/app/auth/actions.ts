"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/actions";
import { siteUrl, supabaseKey, supabaseUrl } from "@/lib/env";
import { sessionClient } from "@/lib/supabase";

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

  const client = await sessionClient();
  const result = await client.auth.signUp({
    email: address.data, password: password.data,
    options: { emailRedirectTo: new URL("/auth/confirm", siteUrl()).href },
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

  const client = await sessionClient();
  const result = await client.auth.signInWithPassword({ email: address.data, password: password.data });
  if (result.error || !result.data.user?.email_confirmed_at) {
    if (result.data.session) await client.auth.signOut();
    if (result.error?.status === 429) return error("Too many attempts. Try again later.");
    return error("Couldn’t sign in. Check your details and make sure you’ve verified your email.");
  }
  redirect("/studio");
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
  const result = await client.auth.verifyOtp({ type: "email", token_hash: token.data });
  if (result.error || !result.data.user?.email_confirmed_at) return error("This verification link has expired or already been used.");
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
  redirect("/sign-in?reset=1");
}

export async function signOut() {
  const client = await sessionClient();
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) redirect("/studio?logout=failed");
  redirect("/");
}
