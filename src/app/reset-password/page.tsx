import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/shell";
import { resetPassword } from "../auth/actions";

export const metadata = { title: "Choose a new password", description: "Set a new password for your Snoozer account.", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ token_hash?: string }> }) {
  const { token_hash: token } = await searchParams;
  return <AuthShell title="Choose a new password" description="This link can be used once.">
    {typeof token === "string" ? <AuthForm action={resetPassword} label="Set new password" token={token} password="new" />
      : <Link className="button primary" href="/forgot-password">Request a reset link</Link>}
  </AuthShell>;
}
