import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { GiftCodeForm } from "@/components/gift-code-form";
import { KofiReviewForm } from "@/components/kofi-review-form";
import { Brand } from "@/components/shell";
import { supabaseKey, supabaseUrl } from "@/lib/env";
import { accountPlan } from "@/lib/entitlements";
import { maximumProfileLinkLimit, username } from "@/lib/profile";
import { requireAccount } from "@/lib/profiles-server";
import { storageAdmin } from "@/lib/supabase";
import { sandboxPaidGiftConfiguration } from "@/lib/stripe-sandbox-paid-gift";
import { sandboxCheckoutKey } from "@/lib/stripe-sandbox-checkout-config";
import { sandboxPortalConfiguration } from "@/lib/stripe-sandbox-portal";
import { openSandboxPortal } from "./portal";
import { startSandboxCheckout } from "./checkout";

export const metadata = { title: "Plan and usage", robots: { index: false, follow: false } };

const reviewList = z.array(z.object({
  reference: z.string(), status: z.enum(["pending", "confirmed", "declined"]),
}));
const reviewLabels = { pending: "Pending review", confirmed: "Confirmed", declined: "Declined" };
const profileList = z.array(z.object({ id: z.uuid(), username, published: z.boolean() }));

const labels = { free: "Free", plus: "Plus", pro: "Pro", studio: "Studio" };
const mediaAmount = new Intl.NumberFormat("en-GB", { style: "unit", unit: "megabyte", maximumFractionDigits: 3 });

function formatMediaBytes(bytes: number) {
  if (bytes > 0 && bytes < 1000) return `${bytes} B`;
  return mediaAmount.format(bytes / 1_000_000);
}

async function sandboxOffers() {
  if (!sandboxCheckoutKey()) return [];
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
  const { client } = await requireAccount();
  const { data, error } = await client.rpc("get_my_plan");
  const result = accountPlan.safeParse(data);
  const plan = error || !result.success ? null : result.data;
  const linkLimit = Math.min(plan?.quotas.links ?? 0, maximumProfileLinkLimit);

  const [offers, { checkout, portal }, portalCustomer, reviewResponse, staffAccess, profileResponse] = await Promise.all([
    sandboxOffers(), searchParams,
    sandboxPortalConfiguration() ? client.rpc("get_my_stripe_sandbox_customer") : null,
    client.rpc("list_my_kofi_donation_reviews"),
    client.rpc("can_read_billing_diagnostics"),
    client.rpc("list_my_profiles"),
  ]);

  const reviews = reviewList.safeParse(reviewResponse.data);
  const profiles = profileList.safeParse(profileResponse.data);

  return <main className="shell">
    <header className="nav"><Brand /><Link className="button small" href="/studio">Back to Studio</Link></header>
    <section className="panel stack">
      <h1>Plan and usage</h1>
      {sandboxPaidGiftConfiguration() && <Link href="/studio/plan/gifts">Sandbox plan gifts</Link>}
      {!staffAccess.error && staffAccess.data === true && <Link href="/studio/billing-diagnostics" prefetch={false}>Billing diagnostics</Link>}
      {plan ? <>
        <p>Current plan: <strong>{labels[plan.plan]}</strong></p>
        {plan.expiresAt && <p>Plan access ends on <time dateTime={plan.expiresAt}>
          {new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" }).format(new Date(plan.expiresAt))}
        </time>.</p>}
        {plan.plan !== "free" && <p>Higher profile allowances are pending.</p>}
        <dl className="stack">
          <div><dt>Published profiles</dt><dd>{plan.usage.publishedProfiles} of 1</dd></div>
          <div><dt>Draft links</dt><dd>{plan.usage.draftLinks} of {linkLimit}</dd></div>
          <div><dt>Media storage</dt><dd>{formatMediaBytes(plan.usage.mediaBytes)} of {formatMediaBytes(plan.quotas.mediaBytes)}</dd></div>
        </dl>
        {plan.usage.draftLinks >= linkLimit && <p>Your draft has reached the Studio link limit.</p>}
        {plan.usage.mediaBytes >= plan.quotas.mediaBytes
          ? <p>Your plan’s media storage is full. Stored images remain available.</p>
          : plan.usage.mediaBytes >= plan.quotas.mediaBytes * 0.85 && <p>You’re close to your plan’s media storage limit.</p>}
      </> : <p role="alert">Plan and usage are temporarily unavailable.</p>}
      <div className="stack">
        <h2>Your profiles</h2>
        {profileResponse.error || !profiles.success ? <p>Couldn’t load your profiles.</p> :
          profiles.data.length === 0 ? <Link href="/studio">Claim a profile in Studio</Link> :
          <ul>{profiles.data.map((profile) => <li key={profile.id}>
            {profile.published ? <Link href={`/${profile.username}`}>@{profile.username}</Link> : `@${profile.username} · Draft`}
          </li>)}</ul>}
      </div>
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
