import Link from "next/link";
import { AuthShell } from "@/components/shell";

export default function NotFound() {
  return <AuthShell title="Page not found" description="Check the address or ask the owner whether the page is live.">
    <Link href="/">Back to Snoozer</Link>
  </AuthShell>;
}
