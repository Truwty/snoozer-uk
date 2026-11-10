import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/shell";
import { requestReset } from "../auth/actions";

export default function Page() {
  return <AuthShell title="Reset your password" description="We’ll email a link to choose a new password.">
    <AuthForm action={requestReset} label="Send reset link" email />
  </AuthShell>;
}
