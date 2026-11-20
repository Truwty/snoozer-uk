"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readAnalyticsConsent, saveAnalyticsConsent } from "@/lib/analytics-consent";

const preferenceChanged = "snoozer-analytics-consent-change";
const openPreferences = "snoozer-open-privacy-settings";

function privacySignal() {
  return navigator.doNotTrack === "1" || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
}

export function CookieConsent() {
  const [choice, setChoice] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [signal, setSignal] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function sync() {
      const hasPrivacySignal = privacySignal();
      setSignal(hasPrivacySignal);
      try {
        let current = readAnalyticsConsent(localStorage);
        if (hasPrivacySignal && current === true) {
          saveAnalyticsConsent(localStorage, false);
          current = false;
        }
        setChoice(current);
        setError("");
      } catch {
        setChoice(null);
        setError("Your browser could not save a preference. Optional analytics will stay off.");
      }
    }
    function showPreferences() { setOpen(true); }
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(preferenceChanged, sync);
    window.addEventListener(openPreferences, showPreferences);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(preferenceChanged, sync);
      window.removeEventListener(openPreferences, showPreferences);
    };
  }, []);

  function choose(allowed: boolean) {
    if (allowed && signal) return;
    try {
      saveAnalyticsConsent(localStorage, allowed);
      setChoice(allowed);
      setOpen(false);
      setError("");
      window.dispatchEvent(new Event(preferenceChanged));
    } catch {
      setError("Your preference could not be saved. Optional analytics will stay off.");
    }
  }

  const visible = choice === null || open;
  return <>
    {visible ? <section className="consent-banner" aria-labelledby="consent-title" aria-live="polite">
      <div className="consent-copy">
        <h2 id="consent-title">Your privacy choices</h2>
        <p>Sign-in storage keeps your account working. Optional profile analytics use browser storage to count visits and link clicks; they are off unless you allow them. Snoozer does not use advertising cookies. <Link href="/privacy">Read the Privacy Policy</Link>.</p>
        {signal && <p className="consent-message">Your browser privacy signal keeps optional analytics off.</p>}
        {error && <p className="consent-message" role="status">{error}</p>}
      </div>
      <div className="actions">
        <button className="button small" type="button" onClick={() => choose(false)}>Only necessary</button>
        <button className="button primary small" type="button" disabled={signal} onClick={() => choose(true)}>Allow optional analytics</button>
      </div>
    </section> : <button className="consent-settings" type="button" onClick={() => setOpen(true)}>Privacy settings</button>}
  </>;
}

export function PrivacyPreferencesButton() {
  return <button className="button small" type="button" onClick={() => window.dispatchEvent(new Event(openPreferences))}>
    Manage privacy choices
  </button>;
}
