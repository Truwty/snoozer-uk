"use client";

import { AuthShell } from "@/components/shell";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <AuthShell title="Page unavailable" description="We couldn’t load this page. Try again in a moment.">
    <button className="button" onClick={reset}>Try again</button>
  </AuthShell>;
}
