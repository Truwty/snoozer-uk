"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

export function StatusAutoRefresh({ checkedAt }: { checkedAt: string }) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();

  useEffect(() => {
    const interval = window.setInterval(() => {
      startTransition(() => router.refresh());
    }, 60_000);

    return () => window.clearInterval(interval);
  }, [router]);

  return (
    <div className="status-refresh">
      <span>Last checked {checkedAt}</span>
      <button
        type="button"
        className="status-refresh-button"
        onClick={() => startTransition(() => router.refresh())}
        disabled={refreshing}
        aria-label="Refresh status"
      >
        <span aria-hidden="true" className={refreshing ? "status-refresh-icon is-refreshing" : "status-refresh-icon"}>↻</span>
        {refreshing ? "Refreshing…" : "Refresh"}
      </button>
      <span className="status-refresh-hint">Auto-refreshes every minute</span>
    </div>
  );
}
