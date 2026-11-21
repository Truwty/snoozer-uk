"use client";

import Link from "next/link";
import { useState } from "react";

const plans = [
  { name: "Plus", monthly: 3, annual: 30, profiles: 3, links: 100, media: "2 GB", domains: 1, description: "More room for your personal pages.", features: ["3 profiles", "100 links per profile", "2 GB media storage", "1 custom domain"] },
  { name: "Pro", monthly: 6, annual: 60, profiles: 10, links: 500, media: "10 GB", domains: 3, description: "For creators with more to share.", features: ["10 profiles", "500 links per profile", "10 GB media storage", "3 custom domains"] },
  { name: "Studio", monthly: 12, annual: 100, profiles: 50, links: 2000, media: "50 GB", domains: 10, description: "Your whole digital world in one place.", features: ["50 profiles", "2,000 links per profile", "50 GB media storage", "10 custom domains"] },
] as const;

export function PricingPlans() {
  const [annual, setAnnual] = useState(false);
  const money = (amount: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(amount);
  return <section className="pricing-section" aria-labelledby="premium-tiers">
    <div className="pricing-toolbar">
      <div><p className="eyebrow">PLANS & BILLING</p><h2 id="premium-tiers">A plan that fits you.</h2></div>
      <div role="group" aria-label="Billing frequency" className="billing-switch">
        <button type="button" aria-pressed={!annual} onClick={() => setAnnual(false)}>Monthly</button>
        <button type="button" aria-pressed={annual} onClick={() => setAnnual(true)}>Yearly <span>Save more</span></button>
      </div>
    </div>
    <div className="pricing-grid">
      {plans.map((plan) => <article key={plan.name} className={plan.name === "Pro" ? "pricing-card featured" : "pricing-card"}>
        {plan.name === "Pro" && <span className="pricing-feature-label">POPULAR CHOICE</span>}
        <h3>Snoozer {plan.name}</h3>
        <p className="muted">{plan.description}</p>
        <p className="pricing-value"><strong>{money(annual ? plan.annual : plan.monthly)}</strong><span>/{annual ? "year" : "month"}</span></p>
        <p className="pricing-saving">{annual ? `Save ${money(plan.monthly * 12 - plan.annual)} per year` : "Billed monthly, cancel via your billing portal."}</p>
        <Link className="button primary pricing-cta" href="/studio/plan">Choose {plan.name}</Link>
        <ul className="pricing-features">{plan.features.map((feature) => <li key={feature}><span aria-hidden="true">✓</span>{feature}</li>)}</ul>
      </article>)}
    </div>
    <p className="pricing-clarification">These are Snoozer's approved recurring prices in GBP. Live Checkout is being verified before launch. No payment is taken by browsing this page. Once subscriptions are enabled, select a plan in Studio and review the recurring terms before paying.</p>
  </section>;
}
