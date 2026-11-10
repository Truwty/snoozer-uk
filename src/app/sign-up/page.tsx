import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/shell";
import { register } from "../auth/actions";

export default function Page() {
  return <AuthShell title="Create your account" description="Your Snoozer page starts here.">
    <AuthForm action={register} label="Create account" email password="new" />
    <p className="muted">Already have an account? <Link href="/sign-in">Sign in</Link></p>
  </AuthShell>;
}
