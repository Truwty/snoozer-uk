import { clearBrowserCodes } from "./analytics-browser";

export const analyticsConsentKey = "snoozer-analytics-consent-v3";
const legacyConsentKeys = ["snoozer-analytics-consent", "snoozer-analytics-consent-v2"];
type ConsentStorage = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

export function readAnalyticsConsent(storage: ConsentStorage): boolean | null {
  const choice = storage.getItem(analyticsConsentKey);
  if (choice === "yes" || choice === "no") {
    storage.setItem(analyticsConsentKey, choice);
    return choice === "yes";
  }
  if (legacyConsentKeys.some((key) => storage.getItem(key) === "no")) {
    saveAnalyticsConsent(storage, false);
    return false;
  }
  return null;
}

export function saveAnalyticsConsent(storage: ConsentStorage, allowed: boolean) {
  const choice = allowed ? "yes" : "no";
  storage.setItem(analyticsConsentKey, choice);
  if (storage.getItem(analyticsConsentKey) !== choice) throw new Error("Analytics preference was not saved.");
  if (!allowed) {
    for (const key of legacyConsentKeys) storage.setItem(key, "no");
    clearBrowserCodes(storage);
  }
}

export const countryAnalyticsConsentKey = "snoozer-country-analytics-consent-v1";

export function readCountryAnalyticsConsent(storage: ConsentStorage): boolean | null {
  const choice=storage.getItem(countryAnalyticsConsentKey);
  return choice==="yes"?true:choice==="no"?false:null;
}

export function saveCountryAnalyticsConsent(storage: ConsentStorage, allowed: boolean) {
  const choice=allowed?"yes":"no";
  storage.setItem(countryAnalyticsConsentKey,choice);
  if(storage.getItem(countryAnalyticsConsentKey)!==choice)throw new Error("Country analytics preference was not saved.");
}
