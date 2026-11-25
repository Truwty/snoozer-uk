import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/shell";
import { confirmEmail } from "../actions";

export const metadata = { title: "Verify your email", description: "Confirm your email address to start using Snoozer.", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ token_hash?: string; type?: string }> }) {
  const { token_hash: token, type } = await searchParams;
  const emailChange = type === "email_change";
  return <AuthShell title={emailChange ? "Confirm your new email" : "Verify your email"} description={emailChange ? "Confirm this change to update the email address on your Snoozer account." : "Confirm your email to start building your Snoozer page."}>
    {typeof token === "string" ? <AuthForm action={confirmEmail} label={emailChange ? "Confirm email change" : "Verify email"} token={token} emailChange={emailChange} />
      : <Link className="button primary" href="/sign-in">Go to sign in</Link>}
  </AuthShell>;
}
