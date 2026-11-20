import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/shell";
import { requestReset } from "../auth/actions";

export const metadata = { title: "Reset your password", description: "Request a secure link to reset your Snoozer account password.", robots: { index: false, follow: false } };

export default function Page() {
  return <AuthShell title="Reset your password" description="We’ll email a link to choose a new password.">
    <AuthForm action={requestReset} label="Send reset link" email />
  </AuthShell>;
}
