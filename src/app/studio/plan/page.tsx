import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { GiftCodeForm } from "@/components/gift-code-form";
import { KofiReviewForm } from "@/components/kofi-review-form";
import { Brand } from "@/components/shell";
import { supabaseKey, supabaseUrl } from "@/lib/env";
import { accountPlan, can } from "@/lib/entitlements";
import { requireAccount } from "@/lib/profiles-server";
import { storageAdmin } from "@/lib/supabase";
import { sandboxPortalConfiguration } from "@/lib/stripe-sandbox-portal";
import { openSandboxPortal } from "./portal";
import { startSandboxCheckout } from "./checkout";

export const metadata = { title: "Plan and usage", robots: { index: false, follow: false } };

const reviewList = z.array(z.object({
  reference: z.string(), status: z.enum(["pending", "confirmed", "declined"]),
}));
const reviewLabels = { pending: "Pending review", confirmed: "Confirmed", declined: "Declined" };

const labels = { free: "Free", plus: "Plus", pro: "Pro", studio: "Studio" };

async function sandboxOffers() {
  if (!/^(rk|sk)_test_/.test(process.env.STRIPE_SANDBOX_API_KEY ?? "")
      || !process.env.STRIPE_SANDBOX_WEBHOOK_SECRET?.startsWith("whsec_")
      || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const admin = storageAdmin();
  return (await Promise.all(Object.entries(labels).filter(([plan]) => plan !== "free").flatMap(([plan, label]) =>
    (["month", "year"] as const).map(async (interval) => {
      const { data, error } = await admin.rpc("resolve_stripe_sandbox_price", { p_plan: plan, p_interval: interval }).maybeSingle();
      if (error || !data || typeof data !== "object" || !("unit_amount" in data)
          || typeof data.unit_amount !== "number") return null;
      return { plan, label, interval, amount: new Intl.NumberFormat("en-GB", {
        style: "currency", currency: "GBP",
      }).format(data.unit_amount / 100) };
    }),
  ))).filter((item) => item !== null);
}

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ checkout?: string; portal?: string }> }) {
  if (!supabaseUrl || !supabaseKey) redirect("/sign-in");
  const { client, user } = await requireAccount();
  const { data, error } = await client.rpc("get_my_plan");
  const result = accountPlan.safeParse(data);
  const plan = error || !result.success ? null : result.data;
  const hasLinkCapacity = plan && can({ id: user.id, plan },
    { quota: "links", used: plan.usage.draftLinks, increment: 1 }, { ownerId: user.id });

  const [offers, { checkout, portal }, portalCustomer, reviewResponse] = await Promise.all([
    sandboxOffers(), searchParams,
    sandboxPortalConfiguration() ? client.rpc("get_my_stripe_sandbox_customer") : null,
    client.rpc("list_my_kofi_donation_reviews"),
  ]);

  const reviews = reviewList.safeParse(reviewResponse.data);

  return <main className="shell">
    <header className="nav"><Brand /><Link className="button small" href="/studio">Back to Studio</Link></header>
    <section className="panel stack">
      <h1>Plan and usage</h1>
      {plan ? <>
        <p>Current plan: <strong>{labels[plan.plan]}</strong></p>
        {plan.expiresAt && <p>Plan access ends on <time dateTime={plan.expiresAt}>
          {new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" }).format(new Date(plan.expiresAt))}
        </time>.</p>}
        <dl className="stack">
          <div><dt>Published profiles</dt><dd>{plan.usage.publishedProfiles} of {plan.quotas.profiles}</dd></div>
          <div><dt>Draft links</dt><dd>{plan.usage.draftLinks} of {plan.quotas.links}</dd></div>
        </dl>
        {!hasLinkCapacity && <p>Your draft has reached its plan’s link allowance.</p>}
      </> : <p role="alert">Plan and usage are temporarily unavailable.</p>}
      {checkout === "pending" && <p role="status">Returned from sandbox checkout. Payment confirmation is pending.</p>}
      {checkout === "unavailable" && <p role="alert">Could not open sandbox checkout. Try your original offer again or contact support.</p>}
      {portal === "unavailable" && <p role="alert">Could not open the Stripe sandbox portal. Try again later.</p>}
      {!portalCustomer?.error && typeof portalCustomer?.data === "string" && <form action={openSandboxPortal}>
        <button className="button small" type="submit">Manage sandbox billing</button>
      </form>}
      {offers.length > 0 && <div className="stack">
        <h2>Stripe sandbox offers</h2>
        {offers.map(({ plan, label, interval, amount }) => <form key={plan + interval} action={startSandboxCheckout}>
          <input type="hidden" name="plan" value={plan} />
          <input type="hidden" name="interval" value={interval} />
          <button className="button small" type="submit">{label} · {amount} per {interval} · Test checkout</button>
        </form>)}
      </div>}
      <details>
        <summary>Redeem a plan gift</summary>
        <GiftCodeForm />
      </details>
      <details>
        <summary>Review a platform Ko-fi donation</summary>
        <div className="stack">
          <p>Use the transaction reference from your donation to Snoozer. Reviews confirm donations and do not change your plan.</p>
          <KofiReviewForm />
          {reviews.success && reviews.data.length > 0 && <ul>
            {reviews.data.map(({ reference, status }) => <li key={reference}>{reference} · {reviewLabels[status]}</li>)}
          </ul>}
          {!reviews.success && <p>Your previous review requests are temporarily unavailable.</p>}
        </div>
      </details>
    </section>
  </main>;
}
