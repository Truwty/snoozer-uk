import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { PricingPlans } from "@/components/pricing-plans";
import { premiumLiveOffers } from "@/lib/premium-live-service";

export const metadata = {
  title: "Pricing — Plus, Pro & Studio",
  description: "Compare Snoozer Plus, Pro and Studio monthly or yearly subscriptions and choose your plan.",
};

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  // Both the Render and database launch gates must agree before pricing claims Checkout is live.
  const checkoutAvailable = (await premiumLiveOffers()).length === 6;
  return <main className="shell pricing-page">
    <SiteHeader />
    <section className="pricing-hero">
      <p className="eyebrow">SNOOZER PREMIUM</p>
      <h1>Your page. <em>Your rules.</em></h1>
      <p className="lead">Build something personal with more profiles, storage, links and custom domains. No creator marketplace. Just Snoozer Premium.</p>
    </section>
    <PricingPlans checkoutAvailable={checkoutAvailable} />
    <section className="pricing-faq">
      <h2>Questions before upgrading?</h2>
      <div className="pricing-faq-grid">
        <article><h3>Can I start for free?</h3><p>Yes. You can create and publish a free Snoozer page before choosing an upgrade.</p><Link href="/sign-up">Get started</Link></article>
        <article><h3>Can I cancel?</h3><p>The Billing Portal lets subscribers cancel future renewals and update payment details. Your paid access follows the verified billing period.</p><Link href="/help/premium-billing">How billing works</Link></article>
        <article><h3>Where do I pay?</h3><p>Subscriptions are managed in your Studio plan page. {" "}{checkoutAvailable ? "Choose a plan there to continue to Stripe Checkout." : "Live Checkout remains unavailable until production payment checks pass."}</p><Link href="/studio/plan">Open plan and usage</Link></article>
      </div>
    </section>
    <p className="pricing-legal">Please read the <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>, plus our <Link href="/legal">Legal information</Link>. Snoozer is responsible for its own plans; members do not sell products through Snoozer.</p>
  </main>;
}
