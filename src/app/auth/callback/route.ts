import { NextResponse } from "next/server";
import { siteUrl, supabaseKey, supabaseUrl } from "@/lib/env";
import { sessionClient } from "@/lib/supabase";
import { rememberSignedInAccount } from "@/lib/account-switching";

// This route receives the code AFTER Discord has returned it to Supabase.
// Supabase's PKCE verifier lives in the HTTP-only cookie created when login began.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const failed = () => NextResponse.redirect(new URL("/sign-in?discord=failed", siteUrl()), 303);

  if (!code || !supabaseUrl || !supabaseKey) return failed();

  try {
    const client = await sessionClient();
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (error || !data.user?.email_confirmed_at) {
      if (data.session) await client.auth.signOut({ scope: "local" });
      return failed();
    }
    await rememberSignedInAccount();
    return NextResponse.redirect(new URL("/studio", siteUrl()), 303);
  } catch {
    return failed();
  }
}
