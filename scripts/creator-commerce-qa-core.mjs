// Read-only Creator Commerce QA assertions. No credentials, network calls or mutations.
const stripeId = /^acct_[A-Za-z0-9]{1,128}$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const holdTypes = new Set(["refund", "dispute", "fraud"]);

export function inspectCreatorQaPayment({ order, session, disputes, warnings }, now = Date.now()) {
  if (!order || typeof order !== "object" || !uuid.test(order.id || "")
    || !stripeId.test(order.accountId || "") || !stripeId.test(order.platformId || "")
    || order.platformId === order.accountId || !uuid.test(order.versionId || "")) {
    throw new Error("The order is not a valid isolated creator purchase.");
  }
  if (!session || session.object !== "checkout.session" || session.livemode !== false
    || !/^cs_test_[A-Za-z0-9]+$/.test(session.id || "")
    || session.id !== order.checkoutId || session.client_reference_id !== order.id
    || session.metadata?.snoozer_order !== order.id
    || session.metadata?.snoozer_version !== order.versionId
    || session.mode !== "payment" || session.currency !== "gbp"
    || session.amount_total !== order.amount) {
    throw new Error("Provider Checkout does not match the recorded test purchase.");
  }
  if (!Array.isArray(order.holds) || order.holds.some((hold) => !holdTypes.has(hold))
    || !disputes || !Array.isArray(disputes.data) || disputes.has_more !== false
    || !warnings || !Array.isArray(warnings.data) || warnings.has_more !== false) {
    throw new Error("Risk evidence is missing or incomplete.");
  }

  const payment = session.payment_intent;
  const charge = payment && typeof payment === "object" ? payment.latest_charge : null;
  if (!payment || typeof payment !== "object" || payment.id !== order.paymentId
    || payment.livemode !== false || !charge || typeof charge !== "object"
    || charge.id !== order.chargeId || charge.livemode !== false
    || charge.payment_intent !== payment.id || charge.currency !== "gbp"
    || charge.amount !== order.amount || !Number.isInteger(charge.amount_refunded)
    || charge.amount_refunded < 0 || charge.amount_refunded > order.amount) {
    throw new Error("Provider payment and charge bindings are incomplete or inconsistent.");
  }
  for (const d of disputes.data) {
    if (d?.object !== "dispute" || d.livemode !== false || d.charge !== charge.id) {
      throw new Error("Dispute belongs to another charge or is not test-mode evidence.");
    }
  }
  for (const w of warnings.data) {
    if (w?.object !== "radar.early_fraud_warning" || w.livemode !== false || w.charge !== charge.id) {
      throw new Error("Fraud warning belongs to another charge or is not test-mode evidence.");
    }
  }
  const risk = {
    refund: charge.amount_refunded > 0 || charge.refunded === true,
    dispute: charge.disputed === true || disputes.data.length > 0,
    fraud: warnings.data.length > 0 || charge.fraud_details?.user_report === "fraudulent"
      || charge.fraud_details?.stripe_report === "fraudulent"
      || charge.outcome?.risk_level === "highest",
  };
  const holds = new Set(order.holds);
  const missingHolds = Object.keys(risk).filter((type) => risk[type] && !holds.has(type));
  const paid = order.state === "paid" && session.status === "complete"
    && session.payment_status === "paid" && payment.status === "succeeded"
    && charge.paid === true && charge.captured === true && charge.status === "succeeded"
    && payment.amount_received === order.amount
    && !!order.paidAt && !!order.accessUntil && Number.isFinite(Date.parse(order.accessUntil));
  const accessWindowOpen = paid && Date.parse(order.accessUntil) > now;
  return {
    paid,
    accessWindowOpen,
    providerRisk: risk,
    storedHolds: { refund: holds.has("refund"), dispute: holds.has("dispute"), fraud: holds.has("fraud") },
    riskObserved: Object.values(risk).some(Boolean),
    allObservedRiskHeld: missingHolds.length === 0,
    missingHolds, // only categories, never customer IDs
    storedAccessEligible: paid && accessWindowOpen && holds.size === 0,
  };
}
