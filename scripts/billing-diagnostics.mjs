import { createClient } from "@supabase/supabase-js";

const [mode, after, ...extra] = process.argv.slice(2);
if (extra.length || (mode && mode !== "--legacy-holds")
    || (after && !/^(invoice:in_|gift:pi_)[A-Za-z0-9]{1,128}$/.test(after))) {
  throw new Error("Usage: npm run billing:diagnostics -- [--legacy-holds [cursor]]");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Set the target Supabase URL and server credential.");

const client = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) },
});
const { data, error } = await (mode === "--legacy-holds"
  ? client.rpc("list_legacy_billing_holds", { p_after: after ?? "" })
  : client.rpc("get_billing_diagnostics"));
if (error) throw new Error("Billing diagnostics are temporarily unavailable.");
console.log(JSON.stringify(data, null, 2));
