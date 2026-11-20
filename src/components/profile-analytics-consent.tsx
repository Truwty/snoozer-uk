"use client";

import { useEffect, useRef, useState } from "react";
import { browserAttribution } from "@/lib/analytics-context";
import { browserCode } from "@/lib/analytics-browser";
import { readAnalyticsConsent, saveAnalyticsConsent } from "@/lib/analytics-consent";

export function ProfileAnalyticsConsent({ username }: { username: string }) {
  const [allowed, setAllowed] = useState(false);
  const counted = useRef<string | null>(null);
  const [privacySignal, setPrivacySignal] = useState(false);
  const [preferenceError, setPreferenceError] = useState("");

  useEffect(() => {
    function syncPreference(event?: Event) {
      const signal = navigator.doNotTrack === "1" || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
      setPrivacySignal(signal);
      try {
        const storageEvent = event instanceof StorageEvent ? event : undefined;
        if (["snoozer-analytics-consent", "snoozer-analytics-consent-v2"].includes(storageEvent?.key ?? "") && storageEvent?.newValue === "no") {
          saveAnalyticsConsent(localStorage, false);
        }
        let choice = readAnalyticsConsent(localStorage);
        if (signal && choice === true) {
          saveAnalyticsConsent(localStorage, false);
          choice = false;
        }
        setAllowed(!signal && choice === true);
        setPreferenceError("");
      } catch {
        setAllowed(false);
        setPreferenceError("Your browser could not save this choice. Analytics remain off.");
      }
    }
    syncPreference();
    window.addEventListener("storage", syncPreference);
    window.addEventListener("snoozer-analytics-consent-change", syncPreference);
    return () => {
      window.removeEventListener("storage", syncPreference);
      window.removeEventListener("snoozer-analytics-consent-change", syncPreference);
    };
  }, []);

  useEffect(() => {
    if (!allowed || !globalThis.crypto?.randomUUID) return;
    function send(payload: object) {
      let code: { browser?: string; browserDay?: string } = {};
      try { code = browserCode(localStorage, username, new Date(), () => crypto.randomUUID()); } catch { /* Storage access itself can be blocked. */ }
      void fetch("/api/v1/analytics/view", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...browserAttribution(window.location.href, document.referrer),
          ...code,
          version: 3, username, consent: true, id: crypto.randomUUID(), ...payload }), keepalive: true,
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
      saveAnalyticsConsent(localStorage, next);
      setAllowed(next);
      setPreferenceError("");
      window.dispatchEvent(new Event("snoozer-analytics-consent-change"));
    } catch {
      setAllowed(false);
      setPreferenceError("Your browser could not save this choice. Analytics remain off.");
    }
  }

  return <details className="analytics-preference">
    <summary>Analytics preferences</summary>
    <p>Help creators see page views, link clicks, daily browser counts, coarse traffic-source and device groups, and Snoozer campaign codes. This optional choice applies across Snoozer profiles on this browser. A random code stored on your browser is independent for each profile and UTC day. We store its scoped hash briefly to deduplicate daily browser counts, without your IP address, full referrer or full user agent. Expired browser codes are removed on a later visit; they are never reused. Turning off stops future collection and removes these browser codes. Previously recorded aggregate counts remain.</p>
    {privacySignal && <p>Your browser privacy signal has disabled analytics.</p>}
    {preferenceError && <p className="message error" role="status">{preferenceError}</p>}
    <button className="button small" type="button" disabled={privacySignal} onClick={() => changePreference(!allowed)}>
      {allowed ? "Turn off profile analytics" : "Allow profile analytics"}
    </button>
  </details>;
}
