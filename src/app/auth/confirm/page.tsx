import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/shell";
import { confirmEmail } from "../actions";

export default async function Page({ searchParams }: { searchParams: Promise<{ token_hash?: string }> }) {
  const { token_hash: token } = await searchParams;
  return <AuthShell title="Verify your email" description="Confirm your email to start building your Snoozer page.">
    {typeof token === "string" ? <AuthForm action={confirmEmail} label="Verify email" token={token} />
      : <Link href="/sign-in">Go to sign in</Link>}
  </AuthShell>;
}
