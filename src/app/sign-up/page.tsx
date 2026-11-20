import { referralCode } from "@/lib/referrals";
import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/shell";
import { register, signInWithDiscord } from "../auth/actions";

export const metadata = { title: "Create an account", description: "Create a Snoozer account and start building your personal page.", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ ref?: string | string[] }> }) {
  const referral = referralCode.safeParse((await searchParams).ref);
  return <AuthShell title="Create your account" description="Your Snoozer page starts here.">
    <AuthForm action={register} label="Create account" email password="new" referral={referral.success ? referral.data : undefined} />
    <p className="muted">Or create an account with Discord</p>
    <form action={signInWithDiscord}>
      <button type="submit" className="button">Continue with Discord</button>
    </form>
    <p className="muted">Already have an account? <Link href="/sign-in">Sign in</Link></p>
  </AuthShell>;
}
