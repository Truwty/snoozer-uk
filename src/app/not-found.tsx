import Link from "next/link";
import { AuthShell } from "@/components/shell";

export const metadata = { title: "Page not found", description: "The requested Snoozer page could not be found.", robots: { index: false, follow: false } };

export default function NotFound() {
  return <AuthShell title="Page not found" description="Check the address or ask the owner whether the page is live.">
    <Link className="button primary" href="/">Back to Snoozer</Link>
  </AuthShell>;
}
