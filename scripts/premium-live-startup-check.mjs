// This startup audit calls only Stripe GET endpoints. It does not create customers,
// Checkout sessions, charges, refunds, prices, or subscriptions.
// Never log key material, full provider errors, or request headers.
import Stripe from "stripe";

const intended = [
  ["price_1UeLyLBYH85ysT1BICf5EPJr", "prod_VfgMlUsOz4GELl", 300, "month"],
  ["price_1UeLyYBYH85ysT1BEz7ehZP4", "prod_VfgMlUsOz4GELl", 3000, "year"],
  ["price_1UeLycBYH85ysT1BqE6guCme", "prod_VfgMPjnzui1zGl", 600, "month"],
  ["price_1UeLyfBYH85ysT1BABUEkalJ", "prod_VfgMPjnzui1zGl", 6000, "year"],
  ["price_1UeLyjBYH85ysT1Bg7JnkUTg", "prod_VfgMvCX05yAJSj", 1200, "month"],
  ["price_1UeLypBYH85ysT1BnlVlQOVH", "prod_VfgMvCX05yAJSj", 10000, "year"],
];

const classifyError = (error) => {
  const code = Number(error?.statusCode);
  // Do not print provider response bodies or exceptions: sensitive details
  // can appear in error messages and request contexts.
  return code === 401 ? "unauthorized"
    : code === 403 ? "insufficient_permissions"
    : code === 404 ? "not_found"
    : code >= 400 && code < 500 ? "stripe_request_rejected"
    : "unavailable";
};

async function audit() {
  const key = process.env.STRIPE_PREMIUM_LIVE_API_KEY;
  const accountId = process.env.STRIPE_PREMIUM_LIVE_ACCOUNT_ID;
  const portalId = process.env.STRIPE_PREMIUM_LIVE_PORTAL_CONFIGURATION;
  const checkoutEnabled = process.env.SNOOZER_PREMIUM_LIVE_ENABLED === "true";
  const report = {
    audit: "snoozer-premium-live-key",
    checkoutEnabled,
    key: "not_configured",
    prices: "not_checked",
    account: "not_checked",
    billingPortal: "not_checked",
  };
  if (!/^(sk|rk)_live_[A-Za-z0-9_]{12,}$/.test(key ?? "")) {
    console.info(JSON.stringify(report));
    return;
  }
  report.key = "format_valid";
  const stripe = new Stripe(key, { maxNetworkRetries: 0, timeout: 8000 });

  // A key for the wrong account must never be accepted: all 6 known LIVE
  // prices are checked for their exact Stripe product, cadence and amount.
  // Parallel read-only checks never create any merchant/customer objects.
  const [prices, account, portal] = await Promise.allSettled([
    stripe.prices.list({ limit: 100, active: true }),
    /^acct_[A-Za-z0-9]+$/.test(accountId ?? "")
      ? stripe.accounts.retrieve(accountId)
      : Promise.reject(new Error("missing account")),
    /^bpc_[A-Za-z0-9]+$/.test(portalId ?? "")
      ? stripe.billingPortal.configurations.retrieve(portalId)
      : Promise.reject(new Error("missing portal")),
  ]);

  if (prices.status === "fulfilled") {
    const catalogue = prices.value;
    const allMatch = !catalogue.has_more && intended.every(([id, product, amount, interval]) =>
      catalogue.data.some(p =>
        p.id === id && p.livemode && p.active && p.currency === "gbp" &&
        p.product === product && p.unit_amount === amount &&
        p.recurring?.interval === interval && p.recurring?.interval_count === 1 &&
        p.recurring?.usage_type === "licensed",
      ));
    report.prices = allMatch ? "verified_six" : "catalogue_mismatch";
    if (allMatch) report.key = "authenticated_for_snoozer_prices";
  } else report.prices = classifyError(prices.reason);

  if (account.status === "fulfilled") {
    report.account = account.value.id === accountId && account.value.charges_enabled
      ? "verified" : "mismatch";
  } else report.account = classifyError(account.reason);

  if (portal.status === "fulfilled") {
    report.billingPortal = portal.value.id === portalId &&
      portal.value.livemode && portal.value.active &&
      portal.value.features?.subscription_cancel?.enabled &&
      portal.value.features?.payment_method_update?.enabled
      ? "verified" : "mismatch";
  } else report.billingPortal = classifyError(portal.reason);

  console.info(JSON.stringify(report));
}

// Never take down the main website because Stripe is temporarily unreachable.
// Payment activation remains blocked independently by 2 explicit launch gates
// and the private Supabase policy; this diagnostic only reports status.
await audit().catch(() => {
  console.info(JSON.stringify({
    audit: "snoozer-premium-live-key",
    key: "unverified",
    prices: "unavailable",
    account: "unavailable",
    billingPortal: "unavailable",
  }));
});
