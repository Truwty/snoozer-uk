import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/shell";
import { signIn, signInWithDiscord } from "../auth/actions";

export const metadata = { title: "Sign in", description: "Sign in to manage your Snoozer profile.", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ reset?: string; discord?: string }> }) {
  const { reset, discord } = await searchParams;
  return <AuthShell title="Welcome back" description="Sign in to manage your page.">
    {reset === "1" && <p role="status">Your password has been updated.</p>}
    {discord === "failed" && <p role="alert">Discord sign-in could not be completed. Please try again.</p>}
    {discord === "unavailable" && <p role="alert">Discord sign-in is temporarily unavailable.</p>}
    <AuthForm action={signIn} label="Sign in" email password="current" />
    <p className="muted">Or use your Discord account</p>
    <form action={signInWithDiscord}>
      <button type="submit" className="button">Continue with Discord</button>
    </form>
    <p><Link href="/forgot-password">Forgot your password?</Link></p>
    <p className="muted">New to Snoozer? <Link href="/sign-up">Create an account</Link></p>
  </AuthShell>;
}
