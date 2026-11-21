import { Card, ProgressBar } from "@/components/ui";
import { siteUrl } from "@/lib/env";
import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { GiftCodeForm } from "@/components/gift-code-form";
import { ClaimForm } from "@/components/claim-form";
import { KofiReviewForm } from "@/components/kofi-review-form";
import { Brand } from "@/components/shell";
import { supabaseKey, supabaseUrl } from "@/lib/env";
import { accountPlan } from "@/lib/entitlements";
import { maximumProfileLinkLimit, username } from "@/lib/profile";
import { readDraft, requireAccount, studioHref, type StudioProfileQuery } from "@/lib/profiles-server";
import { storageAdmin } from "@/lib/supabase";
import { sandboxPaidGiftConfiguration } from "@/lib/stripe-sandbox-paid-gift";
import { sandboxCheckoutKey } from "@/lib/stripe-sandbox-checkout-config";
import { sandboxPortalConfiguration } from "@/lib/stripe-sandbox-portal";
import { openSandboxPortal } from "./portal";
import { premiumLiveOffers } from "@/lib/premium-live-service";
import { premiumLivePortalConfig } from "@/lib/premium-live-config";
import { startPremiumLiveCheckout, openPremiumLiveBillingPortal } from "./live-actions";
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

export default async function PlanPage({ searchParams }: { searchParams: Promise<StudioProfileQuery & { checkout?: string; portal?: string; premium?: string }> }) {
  if (!supabaseUrl || !supabaseKey) redirect("/sign-in");
  const { client } = await requireAccount();
  const { data, error } = await client.rpc("get_my_plan");
  const result = accountPlan.safeParse(data);
  const plan = error || !result.success ? null : result.data;
  const showSandbox = !["snoozer.uk", "www.snoozer.uk"].includes(siteUrl().hostname);
  const linkLimit = Math.min(plan?.quotas.links ?? 0, maximumProfileLinkLimit);

  const [offers, liveOffers, { checkout, portal, premium, profile: requested }, portalCustomer, liveBilling, reviewResponse, staffAccess, profileResponse] = await Promise.all([
    sandboxOffers(), premiumLiveOffers(), searchParams,
    sandboxPortalConfiguration() ? client.rpc("get_my_stripe_sandbox_customer") : null,
    premiumLivePortalConfig() ? client.rpc("get_my_premium_live_billing") : null,
    client.rpc("list_my_kofi_donation_reviews"),
    client.rpc("can_read_billing_diagnostics"),
    client.rpc("list_my_profiles"),
  ]);

  const reviews = reviewList.safeParse(reviewResponse.data);
  const profiles = profileList.safeParse(profileResponse.data);
  const selected = profiles.success ? profiles.data.find(({ id }) => id === requested)?.id : undefined;
  const draft = await readDraft(selected);
  const linksUsed = draft?.links.length ?? 0;

  return <main className="shell">
    <header className="nav"><Brand /><Link className="button small" href={studioHref("/studio", selected)}>Back to Studio</Link></header>
    <section className="stack plan-page">
      <h1>Plan and usage</h1>
      {showSandbox && sandboxPaidGiftConfiguration() && <Link href="/studio/plan/gifts">Sandbox plan gifts</Link>}
      {!staffAccess.error && staffAccess.data === true && <Link href="/studio/billing-diagnostics" prefetch={false}>Billing diagnostics</Link>}
      {plan ? <>
        <Card><p className="eyebrow">CURRENT PLAN</p><p className="current-plan">Current plan: <strong>{labels[plan.plan]}</strong></p>
        {plan.expiresAt && <p>Plan access ends on <time dateTime={plan.expiresAt}>
          {new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" }).format(new Date(plan.expiresAt))}
        </time>.</p>}
        <dl className="stack">
          <div><dt>Published profiles</dt><dd><ProgressBar label="Published profiles" value={plan.usage.publishedProfiles} max={plan.quotas.profiles} description={`${plan.usage.publishedProfiles} of ${plan.quotas.profiles}`} /></dd></div>
          <div><dt>{draft ? `Draft links for @${draft.username}` : "Draft links"}</dt><dd><ProgressBar label="Draft links" value={linksUsed} max={linkLimit} description={`${linksUsed} of ${linkLimit}`} /></dd></div>
          <div><dt>Media storage</dt><dd><ProgressBar label="Media storage" value={plan.usage.mediaBytes} max={plan.quotas.mediaBytes} description={`${formatMediaBytes(plan.usage.mediaBytes)} of ${formatMediaBytes(plan.quotas.mediaBytes)}`} /></dd></div>
        </dl></Card>
        {draft && linksUsed >= linkLimit && <p>Your draft has reached the Studio link limit.</p>}
        {plan.usage.mediaBytes >= plan.quotas.mediaBytes
          ? <p>Your plan’s media storage is full. Stored images remain available.</p>
          : plan.usage.mediaBytes >= plan.quotas.mediaBytes * 0.85 && <p>You’re close to your plan’s media storage limit.</p>}
      </> : <p role="alert">Plan and usage are temporarily unavailable.</p>}
      <div className="stack">
        <h2>Your profiles</h2>
        {profileResponse.error || !profiles.success ? <p>Couldn’t load your profiles.</p> :
          profiles.data.length === 0 ? <Link href="/studio">Claim a profile in Studio</Link> :
          <ul>{profiles.data.map((profile) => <li key={profile.id}>
            {profile.published ? <Link href={`/${profile.username}`}>@{profile.username}</Link> :
              <span>@{profile.username} · Draft</span>}
            {" · "}<Link href={studioHref("/studio", profile.id)} aria-label={`Edit @${profile.username}`}>Edit</Link>
          </li>)}</ul>}
        {plan && !profileResponse.error && profiles.success && profiles.data.length > 0
          && profiles.data.length < plan.quotas.profiles && <details>
          <summary>Claim another profile</summary>
          <ClaimForm additional />
        </details>}
      </div>
      {premium === "processing" && <p role="status">Returned from Stripe. Your Premium plan activates only after Snoozer verifies Stripe's payment and subscription records. Reload your plan after confirmation.</p>}
      {premium === "unavailable" && <p role="alert">Premium Checkout is unavailable. No charge was initiated by this attempt. Please contact Snoozer support if an earlier payment may have completed.</p>}
      {premium === "portal-unavailable" && <p role="alert">Your Premium Billing Portal could not be opened. Contact support if you need to cancel or update your subscription.</p>}
      {premium === "cancelled" && <p role="status">You left Checkout without a confirmed purchase. You have not been upgraded.</p>}
      {!showSandbox && liveOffers.length > 0 && <section className="stack" aria-label="Snoozer Premium upgrades">
        <h2>Upgrade to Snoozer Premium</h2>
        <p>Billed automatically each month or year until cancelled. Applicable tax is calculated by Stripe at Checkout. You can cancel through your billing portal; access depends on your verified paid billing period. Read the <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link> before subscribing.</p>
        <div className="plan-offers">{liveOffers.map(item => <form action={startPremiumLiveCheckout} className="panel stack plan-offer" key={item.price_id}>
          <h3>{labels[item.plan]}</h3>
          <p className="offer-price">{new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP"}).format(item.unit_amount/100)} <small>per {item.billing_interval === "month" ? "month" : "year"}, plus any applicable taxes</small></p>
          <input type="hidden" name="plan" value={item.plan}/>
          <input type="hidden" name="interval" value={item.billing_interval}/>
          <button className="button primary" type="submit">Subscribe to {labels[item.plan]} ({item.billing_interval === "month" ? "monthly" : "yearly"})</button>
        </form>)}</div>
      </section>}
      {!showSandbox && premiumLivePortalConfig() && !liveBilling?.error &&
        liveBilling?.data?.hasCustomer === true && <form action={openPremiumLiveBillingPortal}>
          <button className="button small" type="submit">Manage Premium subscription, invoices and cancellation</button>
        </form>}
      {showSandbox && checkout === "pending" && <p role="status">Returned from sandbox checkout. Payment confirmation is pending.</p>
      {showSandbox && checkout === "unavailable" && <p role="alert">Could not open sandbox checkout. Try your original offer again or contact support.</p>}
      {showSandbox && portal === "unavailable" && <p role="alert">Could not open the Stripe sandbox portal. Try again later.</p>}
      {showSandbox && !portalCustomer?.error && typeof portalCustomer?.data === "string" && <form action={openSandboxPortal}>
        <button className="button small" type="submit">Manage sandbox billing</button>
      </form>}
      {showSandbox && offers.length > 0 && <div className="stack">
        <h2>Stripe sandbox offers</h2>
        <div className="plan-offers">{offers.map(({ plan, label, interval, amount }) => <form className="panel stack plan-offer" key={plan + interval} action={startSandboxCheckout}>
          <h3>{label}</h3><p className="offer-price">{amount}<small> per {interval}</small></p>
          <input type="hidden" name="plan" value={plan} />
          <input type="hidden" name="interval" value={interval} />
          <button className="button primary" type="submit">{label} · {amount} per {interval} · Test checkout</button>
        </form>)}</div>
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
