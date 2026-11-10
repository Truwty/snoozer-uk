import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/shell";
import { resetPassword } from "../auth/actions";

export default async function Page({ searchParams }: { searchParams: Promise<{ token_hash?: string }> }) {
  const { token_hash: token } = await searchParams;
  return <AuthShell title="Choose a new password" description="This link can be used once.">
    {typeof token === "string" ? <AuthForm action={resetPassword} label="Set new password" token={token} password="new" />
      : <Link href="/forgot-password">Request a reset link</Link>}
  </AuthShell>;
}
