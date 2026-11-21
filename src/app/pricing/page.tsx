import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { premiumLiveCheckoutConfig } from "@/lib/premium-live-config";
import { premiumLiveOffers } from "@/lib/premium-live-service";

export const metadata = {
  title: "Pricing",
  description: "Explore Free, Plus, Pro and Studio plans for your Snoozer profile.",
};

const plans = [
  { name: "Free", monthly: "£0", annual: "£0", subtitle: "For your first page.",
    features: ["Your own Snoozer address", "Profile editor and templates", "Links, projects and images"] },
  { name: "Plus", monthly: "£3", annual: "£30", subtitle: "More room to make it yours.",
    features: ["Everything in Free", "Increased account allowances", "More room for personalisation"] },
  { name: "Pro", monthly: "£6", annual: "£60", subtitle: "For people who want more control.",
    features: ["Everything in Plus", "Higher plan limits", "Expanded Studio features"] },
  { name: "Studio", monthly: "£12", annual: "£100", subtitle: "The most room to create.",
    features: ["Everything in Pro", "Our highest account allowances", "More space for multiple projects"] },
] as const;

export default async function PricingPage() {
  let purchasingEnabled = false;
  if (premiumLiveCheckoutConfig()) {
    try {
      const offers = await premiumLiveOffers();
      purchasingEnabled = offers.length === 6;
    } catch {
      purchasingEnabled = false;
    }
  }
  return <main className="shell pricing-page">
    <SiteHeader />
    <section className="pricing-intro">
      <p className="eyebrow">SNOOZER PREMIUM</p>
      <h1>Make more space for <em>you.</em></h1>
      <p className="lead">Start free, then choose a plan that fits the page you want to build. Every plan is for Snoozer itself—there is no creator marketplace.</p>
      {!purchasingEnabled && <p className="pricing-notice" role="status">Premium purchasing is not open yet. You can view the approved prices and your current plan, but no live payment can be started.</p>}
    </section>
    <section className="pricing-grid" aria-label="Snoozer plans">
      {plans.map((plan) => <article key={plan.name} className={"pricing-card" + (plan.name === "Pro" ? " pricing-featured" : "")}>
        {plan.name === "Pro" && <p className="pricing-highlight">More ways to create</p>}
        <div className="pricing-card-heading"><h2>{plan.name}</h2><p>{plan.subtitle}</p></div>
        <p className="pricing-amount">{plan.monthly}<span> / month</span></p>
        <p className="pricing-annual">{plan.annual} when billed yearly{plan.name === "Free" ? "" : " · save with annual billing"}</p>
        <Link className={"button " + (plan.name === "Pro" ? "primary" : "")} href={plan.name === "Free" ? "/sign-up" : "/studio/plan"}>
          {plan.name === "Free" ? "Get started free" : purchasingEnabled ? "Choose " + plan.name : "View plan in Studio"}
        </Link>
        <ul>{plan.features.map((feature) => <li key={feature}><span aria-hidden="true">✓</span> {feature}</li>)}</ul>
      </article>)}
    </section>
    <section className="pricing-bottom">
      <h2>Your plan, your choice.</h2>
      <p>When Premium Checkout opens, subscriptions will renew monthly or yearly until cancelled. Your Studio plan page is the place to purchase or manage Snoozer Premium. Exact entitlements and your current allowances are shown there.</p>
      <p>Review our <Link href="/terms">Terms</Link>, <Link href="/privacy">Privacy Policy</Link> or visit the <Link href="/help">Help Center</Link> before upgrading.</p>
    </section>
  </main>;
}
