import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/shell";
import { signIn, signInWithDiscord } from "../auth/actions";

export const metadata = { title: "Sign in", description: "Sign in to manage your Snoozer profile.", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ reset?: string; discord?: string; add?: string; limit?: string }> }) {
  const { reset, discord, add, limit } = await searchParams;
  const adding = add === "1";
  return <AuthShell title={adding ? "Add another account" : "Welcome back"} description={adding ? "Your other Snoozer accounts will stay signed in on this browser." : "Sign in to manage your page."}>
    {reset === "1" && <p role="status">Your password has been updated.</p>}
    {discord === "failed" && <p role="alert">Discord sign-in could not be completed. Please try again.</p>}
    {discord === "unavailable" && <p role="alert">Discord sign-in is temporarily unavailable.</p>}
    {limit === "1" && <p role="alert">You can keep up to four accounts signed in on this browser.</p>}
    <AuthForm action={signIn} label={adding ? "Add account" : "Sign in"} email password="current" addAccount={adding} />
    <p className="muted">Or use your Discord account</p>
    <form action={signInWithDiscord}>
      {adding && <input type="hidden" name="add_account" value="1" />}
      <button type="submit" className="button">Continue with Discord</button>
    </form>
    <p><Link href="/forgot-password">Forgot your password?</Link></p>
    <p className="muted">New to Snoozer? <Link href="/sign-up">Create an account</Link></p>
  </AuthShell>;
}
