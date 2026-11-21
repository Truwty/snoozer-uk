import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { inspectCreatorQaPayment } from "./creator-commerce-qa-core.mjs";

// This command ONLY calls Supabase service-role RPC reads and Stripe GET operations.
// It never creates a Checkout, refunds a charge, changes a hold, or retries a webhook.
const args=process.argv.slice(2);
if(args.length!==4 || args[0]!=="--project" || args[2]!=="--qa-order"
  || !/^[a-z]{20}$/.test(args[1])
  || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(args[3])) {
  console.error("Usage: npm run commerce:qa:inspect -- --project <supabase-project-ref> --qa-order <new-isolated-test-order-uuid>");
  process.exit(2);
}
const [projectRef,qaOrder]=[args[1],args[3]];
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.STRIPE_CREATOR_SANDBOX_API_KEY || process.env.STRIPE_SANDBOX_API_KEY;
const platform=process.env.STRIPE_CREATOR_SANDBOX_PLATFORM_ID;
const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url || !serviceKey || !key || !/^(sk|rk)_test_[A-Za-z0-9]+$/.test(key)
  || !/^acct_[A-Za-z0-9]{1,128}$/.test(platform||"")
  || process.env.SNOOZER_CREATOR_SANDBOX_ENABLED!=="true") {
  console.error("Missing or invalid test-only commerce/Supabase configuration. No request made.");
  process.exit(2);
}
let target;
try { target=new URL(url); } catch {
  console.error("Invalid Supabase URL. No request made.");process.exit(2);
}
if(target.origin!==`https://${projectRef}.supabase.co` || target.pathname!=="/"
  || target.username || target.password || target.search || target.hash) {
  console.error("Configured Supabase host does not match the explicitly selected project. No request made.");
  process.exit(2);
}
const client=createClient(url,serviceKey,{
  auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false},
  global:{fetch:(input,init)=>fetch(input,{...init,cache:"no-store",redirect:"error",signal:AbortSignal.timeout(8000)})},
});
const stripe=new Stripe(key,{timeout:8000,maxNetworkRetries:0});
try {
  const platformAccount=await stripe.accounts.retrieve(null);
  if(platformAccount.id!==platform) throw new Error("Stripe test platform account mismatch.");
  const stored=await client.rpc("get_creator_sandbox_order",{p_order:qaOrder});
  if(stored.error||!stored.data) throw new Error("Order lookup is unavailable.");
  const order=stored.data;
  if(order.id!==qaOrder||order.platformId!==platform||!order.checkoutId||!order.chargeId
    ||!order.paymentId||order.state!=="paid")
    throw new Error("The isolated QA order is not a bound, paid test Checkout.");
  const account=await stripe.v2.core.accounts.retrieve(order.accountId,{
    include:["configuration.merchant","defaults"],
  });
  const capabilities=account.configuration?.merchant?.capabilities;
  if(account.livemode!==false||account.closed||account.dashboard!=="full"
    ||capabilities?.card_payments?.status!=="active"
    ||capabilities?.stripe_balance?.payouts?.status!=="active") {
    throw new Error("Connected seller capabilities are unavailable.");
  }
  const scope={stripeAccount:order.accountId};
  const session=await stripe.checkout.sessions.retrieve(order.checkoutId,{
    expand:["payment_intent.latest_charge","line_items"],
  },scope);
  const charge=session.payment_intent && typeof session.payment_intent==="object"
    ? session.payment_intent.latest_charge : null;
  if(!charge||typeof charge!=="object"||charge.id!==order.chargeId)
    throw new Error("Provider charge could not be verified.");
  const [disputes,warnings]=await Promise.all([
    stripe.disputes.list({charge:charge.id,limit:100},scope),
    stripe.radar.earlyFraudWarnings.list({charge:charge.id,limit:100},scope),
  ]);
  const evidence=inspectCreatorQaPayment({order,session,disputes,warnings});
  // No buyer/seller identities, charge IDs, secrets, checkout URLs or file paths in output.
  console.log(JSON.stringify({
    type:"CREATOR_COMMERCE_QA_READ_ONLY",
    verifiedBindings:true,
    paid:evidence.paid,
    accessWindowOpen:evidence.accessWindowOpen,
    providerRisk:evidence.providerRisk,
    recordedHolds:evidence.storedHolds,
    allObservedRiskHeld:evidence.allObservedRiskHeld,
    missingHoldCategories:evidence.missingHolds,
    storedAccessEligible:evidence.storedAccessEligible,
    receiptVerification:"NOT_CHECKED: use supabase/operations/inspect-creator-commerce-risk-evidence.sql and Stripe Workbench",
  },null,2));
  if(!evidence.allObservedRiskHeld){
    console.error("FAIL: provider risk exists but the database has not recorded its matching hold.");
    process.exitCode=1;
  }else if(!evidence.riskObserved){
    console.error("BLOCKED: no refund, dispute or fraud evidence exists for this QA order yet.");
    process.exitCode=2;
  }
}catch{
  // Do not echo provider responses, private buyer information or API error bodies.
  console.error("Creator Commerce read-only verification failed or provider data was incomplete.");
  process.exitCode=1;
}
