import "./homepage-immersive.css";
import Link from "next/link";
import { ClaimForm } from "@/components/claim-form";
import { Brand } from "@/components/shell";
import { SiteHeader } from "@/components/site-header";
import { HomeProfileDemo } from "@/components/home-profile-demo";
import { HomeScrollMotion } from "@/components/home-scroll-motion";
import { HomeFaq } from "@/components/home-faq";
import { FooterLanguagePicker } from "@/components/footer-language-picker";
import { getCurrentAccountLocale } from "@/lib/locale-server";
import { homeContent } from "@/lib/home-translations";

export const metadata = {
  title: "Snoozer — your page, your way",
  description: "Bring your socials, links, photos and projects together on one custom Snoozer profile. Create your page for free.",
};

export default async function Home() {
  const locale = await getCurrentAccountLocale();
  const copy = homeContent(locale);
  const featureNumbers = ["01", "02", "03", "04"];

  return (
    <main className="shell home home-immersive">
      <SiteHeader locale={locale} />
      <HomeScrollMotion />

      <section className="home-hero" aria-labelledby="home-hero-title">
        <div className="home-hero-copy" data-reveal="up">
          <p className="home-offer-badge"><span aria-hidden="true">✦</span> {copy.hero.badge}</p>
          <h1 id="home-hero-title">{copy.hero.title}</h1>
          <p className="home-hero-lead">{copy.hero.lead}</p>
          <div className="home-hero-actions">
            <Link className="button primary" href="/sign-up">{copy.hero.signup} <span aria-hidden="true">↗</span></Link>
            <Link className="button home-secondary-button" href="/pricing">{copy.hero.viewPricing}</Link>
          </div>
          <p className="home-hero-note"><span aria-hidden="true">✓</span> {copy.hero.note}</p>
        </div>
        <div className="home-hero-showcase" data-reveal="up">
          <HomeProfileDemo locale={locale} />
        </div>
      </section>

      <section className="home-social-proof" aria-labelledby="home-proof-title" data-reveal="up">
        <header className="home-section-heading">
          <p className="home-eyebrow">{copy.proof.eyebrow}</p>
          <h2 id="home-proof-title">{copy.proof.title}</h2>
          <p>{copy.proof.description}</p>
        </header>
        <div className="home-metric-grid">
          {copy.features.map((feature, index) => (
            <article className="home-metric-card" key={feature.title}>
              <span className="home-metric-index">{featureNumbers[index]}</span>
              <div><h3>{feature.title}</h3><p>{feature.description}</p></div>
              <span className="home-metric-symbol" aria-hidden="true">{["↗", "✳", "▧", "⌘"][index]}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="home-claim" id="claim" aria-labelledby="home-claim-title" data-reveal="up">
        <div className="home-claim-copy">
          <p className="home-eyebrow">{copy.claim.eyebrow}</p>
          <h2 id="home-claim-title">{copy.claim.title}</h2>
          <p>{copy.claim.description}</p>
        </div>
        <div className="home-claim-form"><ClaimForm hero locale={locale} /></div>
      </section>

      <section className="home-plans" id="pricing" aria-labelledby="home-plans-title">
        <header className="home-section-heading" data-reveal="up">
          <p className="home-eyebrow">{copy.plans.eyebrow}</p>
          <h2 id="home-plans-title">{copy.plans.title}<br /><em>{copy.plans.emphasis}</em></h2>
          <p>{copy.plans.description}</p>
        </header>
        <div className="home-plan-grid">
          <article className="home-plan-card home-plan-free" data-reveal="up">
            <div className="home-plan-heading">
              <p className="home-plan-kicker">{copy.plans.freeKicker}</p>
              <h3>Free</h3>
              <p className="home-plan-price"><strong>£0</strong><span>/ {locale === "en-US" ? "always" : ({ "es-ES": "siempre", "pt-BR": "para sempre", "fr-FR": "à vie", "de-DE": "dauerhaft", "tr-TR": "her zaman" } as const)[locale]}</span></p>
              <p className="home-plan-description">{copy.plans.freeDescription}</p>
            </div>
            <ul className="home-plan-features">
              {copy.plans.freeFeatures.map((feature) => <li key={feature}><span aria-hidden="true">✓</span> {feature}</li>)}
            </ul>
            <Link className="button home-plan-button" href="/sign-up">{copy.plans.freeButton} <span aria-hidden="true">↗</span></Link>
          </article>

          <article className="home-plan-card home-plan-premium" data-reveal="up">
            <p className="home-plan-featured-label">SNOOZER PREMIUM</p>
            <div className="home-plan-heading">
              <p className="home-plan-kicker">{copy.plans.premiumKicker}</p>
              <h3>Premium</h3>
              <p className="home-plan-description">{copy.plans.premiumDescription}</p>
            </div>
            <div className="home-premium-tiers" aria-label={copy.plans.priceLabel}>
              <div><span>PLUS</span><strong>£3<small>/mo</small></strong><small>£30 / year</small></div>
              <div><span>PRO</span><strong>£6<small>/mo</small></strong><small>£60 / year</small></div>
              <div><span>STUDIO</span><strong>£12<small>/mo</small></strong><small>£100 / year</small></div>
            </div>
            <ul className="home-plan-features">
              {copy.plans.premiumFeatures.map((feature) => <li key={feature}><span aria-hidden="true">✓</span> {feature}</li>)}
            </ul>
            <Link className="button primary home-plan-button" href="/pricing">{copy.plans.premiumButton} <span aria-hidden="true">↗</span></Link>
          </article>
        </div>
        <p className="home-plans-note">{copy.plans.pricesNote} <Link href="/pricing">{copy.plans.compareLink}</Link></p>
      </section>

      <section className="home-faq" aria-labelledby="home-faq-title">
        <header className="home-section-heading" data-reveal="up">
          <p className="home-eyebrow">{copy.faq.eyebrow}</p>
          <h2 id="home-faq-title">{copy.faq.title}</h2>
        </header>
        <HomeFaq locale={locale} />
      </section>

      <section className="home-final-cta" data-reveal="up" aria-labelledby="home-final-title">
        <div className="home-final-decoration" aria-hidden="true"><span>☾</span><i>✳</i><i>✦</i></div>
        <div className="home-final-copy">
          <p className="home-eyebrow">{copy.finalCta.eyebrow}</p>
          <h2 id="home-final-title">{copy.finalCta.title}</h2>
          <p>{copy.finalCta.description}</p>
        </div>
        <div className="home-final-form"><ClaimForm hero locale={locale} /></div>
      </section>

      <footer className="home-footer home-footer-redesign">
        <div className="home-footer-main">
          <div className="home-footer-brand">
            <Brand />
            <p>{copy.footer.description}</p>
            <a className="home-footer-email" href="mailto:snoozersupport@snoozer.uk">snoozersupport@snoozer.uk</a>
            <FooterLanguagePicker />
          </div>
          <div className="home-footer-column">
            <h2>{copy.footer.general}</h2>
            <nav aria-label="General links">
              <Link href="/sign-in">{copy.footer.login}</Link>
              <Link href="/sign-up">{copy.footer.signup}</Link>
              <Link href="/pricing">{copy.footer.pricing}</Link>
              <Link href="/leaderboard">{copy.footer.leaderboard}</Link>
            </nav>
          </div>
          <div className="home-footer-column">
            <h2>{copy.footer.resources}</h2>
            <nav aria-label="Resource links">
              <Link href="/help">{copy.footer.help}</Link>
              <Link href="/templates">{copy.footer.templates}</Link>
              <Link href="/discover">{copy.footer.discover}</Link>
              <Link href="/status">Status</Link>
            </nav>
          </div>
          <div className="home-footer-column">
            <h2>{copy.footer.contact}</h2>
            <nav aria-label="Contact links">
              <Link href="/help">{copy.footer.support}</Link>
              <a href="mailto:snoozersupport@snoozer.uk">{copy.footer.supportEmail}</a>
            </nav>
          </div>
          <div className="home-footer-column">
            <h2>{copy.footer.legal}</h2>
            <nav aria-label="Legal links">
              <Link href="/terms">{copy.footer.terms}</Link>
              <Link href="/privacy">{copy.footer.privacy}</Link>
              <Link href="/legal">{copy.footer.legalInfo}</Link>
            </nav>
          </div>
        </div>
        <div className="home-footer-bottom">
          <span>{copy.footer.copyright}</span>
          <span>{copy.footer.tagline}</span>
        </div>
      </footer>
    </main>
  );
}
