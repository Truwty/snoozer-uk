import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Set the target Supabase URL and server credential.");
if (process.argv.length > 2) throw new Error("Usage: npm run cleanup:analytics");
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) },
});
const { data, error } = await client.rpc("purge_profile_analytics");
if (error || !Number.isInteger(data)) throw new Error("Analytics cleanup failed.");
console.log(`Removed ${data} expired daily aggregates; also swept up to 5,000 expired receipts. Repeat to drain backlog.`);
