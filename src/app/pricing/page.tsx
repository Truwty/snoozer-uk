import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { PricingPlans } from "@/components/pricing-plans";

export const metadata = {
  title: "Pricing — Plus, Pro & Studio",
  description: "Compare Snoozer Plus, Pro and Studio monthly or yearly subscriptions and choose your plan.",
};

export default function PricingPage() {
  return <main className="shell pricing-page">
    <SiteHeader />
    <section className="pricing-hero">
      <p className="eyebrow">SNOOZER PREMIUM</p>
      <h1>Your page. <em>Your rules.</em></h1>
      <p className="lead">Build something personal with more profiles, storage, links and custom domains. No creator marketplace. Just Snoozer Premium.</p>
    </section>
    <PricingPlans />
    <section className="pricing-faq">
      <h2>Questions before upgrading?</h2>
      <div className="pricing-faq-grid">
        <article><h3>Can I start for free?</h3><p>Yes. You can create and publish a free Snoozer page before choosing an upgrade.</p><Link href="/sign-up">Get started</Link></article>
        <article><h3>Can I cancel?</h3><p>When live subscriptions launch, the Billing Portal will let you cancel renewals and update your payment details. Your paid access follows the verified billing period.</p><Link href="/help/premium-billing">How billing works</Link></article>
        <article><h3>Where do I pay?</h3><p>Subscriptions are managed in your Studio plan page. Live Checkout remains unavailable until production payment checks pass.</p><Link href="/studio/plan">Open plan and usage</Link></article>
      </div>
    </section>
    <p className="pricing-legal">Please read the <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>. Snoozer is responsible for its own plans; members do not sell products through Snoozer.</p>
  </main>;
}
