import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const checks = [
  ["NEXT_PUBLIC_SITE_URL", (value) => {
    try {
      const url = new URL(value);
      return !url.username && !url.password && value === url.origin
        && (url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)));
    } catch { return false; }
  }],
  ["NEXT_PUBLIC_SUPABASE_URL", (value) => {
    try {
      const url = new URL(value);
      return !url.username && !url.password && !url.search && !url.hash && url.pathname === "/"
        && (url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)));
    } catch { return false; }
  }],
  ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", Boolean],
  ["SUPABASE_SERVICE_ROLE_KEY", Boolean],
  ["STRIPE_SANDBOX_API_KEY", (value) => /^(rk|sk)_test_[A-Za-z0-9]+$/.test(value)],
  ["STRIPE_SANDBOX_WEBHOOK_SECRET", (value) => /^whsec_\S+$/.test(value)],
  ["STRIPE_SANDBOX_GRANTS_ENABLED", (value) => value === "true"],
  ["STRIPE_SANDBOX_PORTAL_CONFIGURATION", (value) => /^bpc_[A-Za-z0-9]+$/.test(value)],
  ["STRIPE_SANDBOX_GIFT_KEY", (value) => /^[a-f0-9]{64}$/i.test(value)],
  ["KOFI_WEBHOOK_TOKEN", Boolean],
];

const invalid = checks.filter(([name, validate]) => !validate(process.env[name]?.trim() ?? "")).map(([name]) => name);
if (invalid.length) {
  console.error("Configure the following values for the isolated provider test environment:");
  for (const name of invalid) console.error("- " + name);
  process.exit(1);
}

const database = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8000), redirect: "error" }) },
});
const stripe = new Stripe(process.env.STRIPE_SANDBOX_API_KEY, { timeout: 8000, maxNetworkRetries: 0 });
const probes = await Promise.allSettled([
  database.rpc("get_billing_diagnostics").then(({ data, error }) => !error && Boolean(data?.stripeSandbox)),
  stripe.prices.list({ active: true, limit: 1 }).then(({ data }) => data.length === 1 && !data[0].livemode),
]);
const expectations = [
  "Supabase service credential and billing diagnostics",
  "Stripe sandbox key and an active sandbox price",
];
for (const [index, probe] of probes.entries()) {
  const passed = probe.status === "fulfilled" && probe.value === true;
  console.log((passed ? "PASS " : "FAIL ") + expectations[index]);
  if (!passed) process.exitCode = 1;
}
if (!process.exitCode) console.log("Run the provider journeys to verify webhook delivery, fulfillment and plan access.");
