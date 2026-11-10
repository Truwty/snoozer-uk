import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/shell";
import { signIn } from "../auth/actions";

export default async function Page({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const { reset } = await searchParams;
  return <AuthShell title="Welcome back" description="Sign in to manage your page.">
    {reset === "1" && <p role="status">Your password has been updated.</p>}
    <AuthForm action={signIn} label="Sign in" email password="current" />
    <p><Link href="/forgot-password">Forgot your password?</Link></p>
    <p className="muted">New to Snoozer? <Link href="/sign-up">Create an account</Link></p>
  </AuthShell>;
}
