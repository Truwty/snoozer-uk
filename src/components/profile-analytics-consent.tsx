"use client";

import { useEffect, useRef, useState } from "react";
import { browserAttribution } from "@/lib/analytics-context";

// Expanded attribution requires a fresh opt-in; never reuse the old view-only choice.
const preferenceKey = "snoozer-analytics-consent-v2";

export function ProfileAnalyticsConsent({ username }: { username: string }) {
  const [allowed, setAllowed] = useState(false);
  const counted = useRef<string | null>(null);
  const [privacySignal, setPrivacySignal] = useState(false);

  useEffect(() => {
    function syncPreference(event?: StorageEvent) {
      const signal = navigator.doNotTrack === "1" || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
      setPrivacySignal(signal);
      try {
        if (event?.key === "snoozer-analytics-consent" && event.newValue === "no") {
          localStorage.setItem(preferenceKey, "no");
        }
        setAllowed(!signal && localStorage.getItem(preferenceKey) === "yes");
      } catch {
        setAllowed(false);
      }
    }
    syncPreference();
    window.addEventListener("storage", syncPreference);
    return () => window.removeEventListener("storage", syncPreference);
  }, []);

  useEffect(() => {
    if (!allowed || !globalThis.crypto?.randomUUID) return;
    function send(payload: object) {
      void fetch("/api/v1/analytics/view", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...browserAttribution(window.location.href, document.referrer), version: 2, username, consent: true, id: crypto.randomUUID(), ...payload }), keepalive: true,
      }).catch(() => undefined);
    }
    if (counted.current !== username) {
      counted.current = username;
      send({ kind: "view" });
    }
    function clicked(event: MouseEvent) {
      if (event.button > 1 || !(event.target instanceof Element)) return;
      const anchor = event.target.closest<HTMLAnchorElement>("a[data-analytics-profile]");
      if (anchor?.dataset.analyticsProfile !== username) return;
      send({ kind: "click", position: Number(anchor.dataset.analyticsPosition), url: anchor.getAttribute("href") });
    }
    document.addEventListener("click", clicked);
    document.addEventListener("auxclick", clicked);
    return () => {
      document.removeEventListener("click", clicked);
      document.removeEventListener("auxclick", clicked);
    };
  }, [allowed, username]);

  function changePreference(next: boolean) {
    try {
      localStorage.setItem(preferenceKey, next ? "yes" : "no");
      if (!next) localStorage.setItem("snoozer-analytics-consent", "no");
    } catch {
      // The choice stays in memory if the browser blocks storage.
    }
    setAllowed(next);
  }

  return <details className="analytics-preference">
    <summary>Analytics preferences</summary>
    <p>Help creators see page views, link clicks, coarse traffic-source and device groups, and Snoozer campaign codes. This optional choice applies across Snoozer profiles on this browser. We store daily counts and short-lived random event receipts, without your IP address, full referrer, full user agent or a visitor ID. Turning off stops future collection.</p>
    {privacySignal && <p>Your browser privacy signal has disabled analytics.</p>}
    <button className="button small" type="button" disabled={privacySignal} onClick={() => changePreference(!allowed)}>
      {allowed ? "Turn off profile analytics" : "Allow profile analytics"}
    </button>
  </details>;
}
