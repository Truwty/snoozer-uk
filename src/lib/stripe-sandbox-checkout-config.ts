import "server-only";

export function sandboxCheckoutKey() {
  const key = process.env.STRIPE_SANDBOX_API_KEY;
  return key && /^(rk|sk)_test_/.test(key)
    && process.env.SUPABASE_SERVICE_ROLE_KEY
    && process.env.STRIPE_SANDBOX_GRANTS_ENABLED === "true"
    && process.env.STRIPE_SANDBOX_WEBHOOK_SECRET?.startsWith("whsec_") ? key : undefined;
}
