"use client";

import { useEffect, useRef, useState } from "react";
import { browserAttribution } from "@/lib/analytics-context";
import { browserCode } from "@/lib/analytics-browser";
import { readAnalyticsConsent, saveAnalyticsConsent, readCountryAnalyticsConsent, saveCountryAnalyticsConsent } from "@/lib/analytics-consent";

export function ProfileAnalyticsConsent({ username }: { username: string }) {
  const [allowed, setAllowed] = useState(false);
  const [countryAllowed,setCountryAllowed]=useState(false);
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
        const countryChoice=readCountryAnalyticsConsent(localStorage);
        if(signal||choice!==true){if(countryChoice===true)saveCountryAnalyticsConsent(localStorage,false);setCountryAllowed(false);}
        else setCountryAllowed(countryChoice===true);
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
    if (!allowed) return;
    function secureUuid(): string | null {
      const cryptoApi = globalThis.crypto;
      if (!cryptoApi) return null;
      if (typeof cryptoApi.randomUUID === "function") return cryptoApi.randomUUID();
      if (typeof cryptoApi.getRandomValues !== "function") return null;
      const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
      return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20);
    }
    function send(payload: object) {
      const id = secureUuid();
      if (!id) return;
      let code: { browser?: string; browserDay?: string } = {};
      try { code = browserCode(localStorage, username, new Date(), () => secureUuid() ?? ""); } catch { /* Storage access itself can be blocked. */ }
      void fetch("/api/v1/analytics/view", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...browserAttribution(window.location.href, document.referrer),
          ...code,
          version: countryAllowed ? 4 : 3, ...(countryAllowed ? { countryConsent: true } : {}), username, consent: true, id, ...payload }), keepalive: true,
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
  }, [allowed, countryAllowed, username]);

  function changePreference(next: boolean) {
    try {
      saveAnalyticsConsent(localStorage, next);
      if(!next){saveCountryAnalyticsConsent(localStorage,false);setCountryAllowed(false);}
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
    <p>Help creators see page views, link clicks, daily browser counts, coarse traffic-source and device groups, and Snoozer campaign codes. Approximate country reporting is a separate opt-in. This optional choice applies across Snoozer profiles on this browser. A random code stored on your browser is independent for each profile and UTC day. We store its scoped hash briefly to deduplicate daily browser counts, without your IP address, full referrer or full user agent. Expired browser codes are removed on a later visit; they are never reused. Turning off stops future collection and removes these browser codes. Previously recorded aggregate counts remain.</p>
    {privacySignal && <p>Your browser privacy signal has disabled analytics.</p>}
    {preferenceError && <p className="message error" role="status">{preferenceError}</p>}
    <button className="button small" type="button" disabled={privacySignal} onClick={() => changePreference(!allowed)}>
      {allowed ? "Turn off profile analytics" : "Allow profile analytics"}
    </button>
    {allowed&&<div className="analytics-country-preference stack">
      <p>Country reporting is a separate choice. If enabled, the hosting edge supplies only an approximate country code. Snoozer stores that code with daily aggregate totals; it does not receive or store your raw IP address for this feature. Totals are hidden until at least three views from a country are recorded.</p>
      <button className="button small" type="button" disabled={privacySignal} onClick={()=>{
        try{
          saveCountryAnalyticsConsent(localStorage,!countryAllowed);
          setCountryAllowed(!countryAllowed);
          window.dispatchEvent(new Event("snoozer-analytics-consent-change"));
        }catch{setCountryAllowed(false);setPreferenceError("Your browser could not save this country choice. Country reporting remains off.");}
      }}>{countryAllowed?"Remove my country from analytics":"Allow approximate country reporting"}</button>
    </div>}
  </details>;
}
