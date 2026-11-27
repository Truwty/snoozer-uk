import { cookies } from "next/headers";
import { accountLocale, defaultAccountLocale } from "@/lib/account-locale";
import { sessionClient } from "@/lib/supabase";

/** Resolve the browser preference first, then the signed-in account preference. */
export async function getCurrentAccountLocale() {
  const jar = await cookies();
  const savedLocale = jar.get("snoozer_locale")?.value;
  if (savedLocale) return accountLocale(savedLocale);

  try {
    const client = await sessionClient();
    const { data, error } = await client.auth.getUser();
    if (!error && data.user) return accountLocale(data.user.user_metadata?.snoozer_locale);
  } catch {
    // Public pages must still render when Auth is unavailable.
  }
  return defaultAccountLocale;
}
