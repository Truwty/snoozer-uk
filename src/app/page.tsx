import "./homepage-immersive.css";
import Link from "next/link";
import { ClaimForm } from "@/components/claim-form";
import { Brand } from "@/components/shell";
import { SiteHeader } from "@/components/site-header";
import { HomeProfileDemo } from "@/components/home-profile-demo";
import { HomeScrollMotion } from "@/components/home-scroll-motion";
import { HomeFaq } from "@/components/home-faq";
import { FooterLanguagePicker } from "@/components/footer-language-picker";

export const metadata = {
  title: "Snoozer — your page, your way",
  description: "Bring your socials, links, photos and projects together on one custom Snoozer profile. Create your page for free.",
};

export default function Home() {
  return (
    <main className="shell home home-immersive">
      <SiteHeader />
      <HomeScrollMotion />

      <section className="home-hero" aria-labelledby="home-hero-title">
        <div className="home-hero-copy" data-reveal="up">
          <p className="home-offer-badge"><span aria-hidden="true">✦</span> YOUR SPACE. YOUR WAY.</p>
          <h1 id="home-hero-title">Everything you want, right here.</h1>
          <p className="home-hero-lead">
            Your socials, photos and projects, brought together on one custom Snoozer profile.
            Build a page that feels like you, then share it with one simple link.
          </p>
          <div className="home-hero-actions">
            <Link className="button primary" href="/sign-up">Sign up for free <span aria-hidden="true">↗</span></Link>
            <Link className="button home-secondary-button" href="/pricing">View pricing</Link>
          </div>
          <p className="home-hero-note"><span aria-hidden="true">✓</span> Free to start. Yours to customise.</p>
        </div>
        <div className="home-hero-showcase" data-reveal="up">
          <HomeProfileDemo />
        </div>
      </section>

      <section className="home-social-proof" aria-labelledby="home-proof-title" data-reveal="up">
        <header className="home-section-heading">
          <p className="home-eyebrow">ONE LINK. YOUR WHOLE WORLD.</p>
          <h2 id="home-proof-title">A little space for everything you do.</h2>
          <p>Bring the things people come to find together, and give them a page that feels unmistakably yours.</p>
        </header>
        <div className="home-metric-grid">
          <article className="home-metric-card">
            <span className="home-metric-index">01</span>
            <div><h3>Your links</h3><p>Keep socials, websites, communities and projects together.</p></div>
            <span className="home-metric-symbol" aria-hidden="true">↗</span>
          </article>
          <article className="home-metric-card">
            <span className="home-metric-index">02</span>
            <div><h3>Your look</h3><p>Make your page yours with themes, layouts, effects and widgets.</p></div>
            <span className="home-metric-symbol" aria-hidden="true">✳</span>
          </article>
          <article className="home-metric-card">
            <span className="home-metric-index">03</span>
            <div><h3>Your media</h3><p>Showcase photos, creative work and supported profile media.</p></div>
            <span className="home-metric-symbol" aria-hidden="true">▧</span>
          </article>
          <article className="home-metric-card">
            <span className="home-metric-index">04</span>
            <div><h3>Your control</h3><p>Choose what to publish and whether to opt into creator discovery.</p></div>
            <span className="home-metric-symbol" aria-hidden="true">⌘</span>
          </article>
        </div>
      </section>

      <section className="home-claim" id="claim" aria-labelledby="home-claim-title" data-reveal="up">
        <div className="home-claim-copy">
          <p className="home-eyebrow">MAKE IT YOURS</p>
          <h2 id="home-claim-title">Claim your profile and get started in minutes.</h2>
          <p>Choose a username people will remember. Your Snoozer address is ready to become your own.</p>
        </div>
        <div className="home-claim-form"><ClaimForm hero /></div>
      </section>

      <section className="home-plans" id="pricing" aria-labelledby="home-plans-title">
        <header className="home-section-heading" data-reveal="up">
          <p className="home-eyebrow">START FREE. GROW WHEN YOU&apos;RE READY.</p>
          <h2 id="home-plans-title">Explore your options.<br /><em>Make room for more.</em></h2>
          <p>Create a page for free, then choose the Snoozer Premium tier that fits the way you create.</p>
        </header>
        <div className="home-plan-grid">
          <article className="home-plan-card home-plan-free" data-reveal="up">
            <div className="home-plan-heading">
              <p className="home-plan-kicker">THE STARTING POINT</p>
              <h3>Free</h3>
              <p className="home-plan-price"><strong>£0</strong><span>/ always</span></p>
              <p className="home-plan-description">For getting started and bringing your socials together in one place.</p>
            </div>
            <ul className="home-plan-features">
              <li><span aria-hidden="true">✓</span> Create and publish a personal page</li>
              <li><span aria-hidden="true">✓</span> Add your links and profile content</li>
              <li><span aria-hidden="true">✓</span> Choose from available themes and layouts</li>
              <li><span aria-hidden="true">✓</span> Share one memorable profile address</li>
            </ul>
            <Link className="button home-plan-button" href="/sign-up">Get started free <span aria-hidden="true">↗</span></Link>
          </article>

          <article className="home-plan-card home-plan-premium" data-reveal="up">
            <p className="home-plan-featured-label">SNOOZER PREMIUM</p>
            <div className="home-plan-heading">
              <p className="home-plan-kicker">MORE ROOM TO CREATE</p>
              <h3>Premium</h3>
              <p className="home-plan-description">More ways to build, customise and grow your online space. Choose a tier and billing cycle.</p>
            </div>
            <div className="home-premium-tiers" aria-label="Snoozer Premium prices">
              <div><span>PLUS</span><strong>£3<small>/mo</small></strong><small>£30 / year</small></div>
              <div><span>PRO</span><strong>£6<small>/mo</small></strong><small>£60 / year</small></div>
              <div><span>STUDIO</span><strong>£12<small>/mo</small></strong><small>£100 / year</small></div>
            </div>
            <ul className="home-plan-features">
              <li><span aria-hidden="true">✓</span> More profile customisation</li>
              <li><span aria-hidden="true">✓</span> Additional profile and media options</li>
              <li><span aria-hidden="true">✓</span> More tools for growing creators</li>
              <li><span aria-hidden="true">✓</span> Monthly and yearly plan options</li>
            </ul>
            <Link className="button primary home-plan-button" href="/pricing">Compare Premium plans <span aria-hidden="true">↗</span></Link>
          </article>
        </div>
        <p className="home-plans-note">Prices are in GBP. <Link href="/pricing">Compare plan limits, features and billing details.</Link></p>
      </section>

      <section className="home-faq" aria-labelledby="home-faq-title">
        <header className="home-section-heading" data-reveal="up">
          <p className="home-eyebrow">A FEW THINGS YOU MIGHT BE WONDERING</p>
          <h2 id="home-faq-title">Frequently Asked Questions</h2>
        </header>
        <HomeFaq />
      </section>

      <section className="home-final-cta" data-reveal="up" aria-labelledby="home-final-title">
        <div className="home-final-decoration" aria-hidden="true"><span>☾</span><i>✳</i><i>✦</i></div>
        <div className="home-final-copy">
          <p className="home-eyebrow">READY WHEN YOU ARE</p>
          <h2 id="home-final-title">Everything you want, right here.</h2>
          <p>Join Snoozer and bring the links, work and moments you want to share into one place.</p>
        </div>
        <div className="home-final-form"><ClaimForm hero /></div>
      </section>

      <footer className="home-footer home-footer-redesign">
        <div className="home-footer-main">
          <div className="home-footer-brand">
            <Brand />
            <p>Your links, your work and everything you want to share. All in one place.</p>
            <a className="home-footer-email" href="mailto:snoozersupport@snoozer.uk">snoozersupport@snoozer.uk</a>
            <FooterLanguagePicker />
          </div>
          <div className="home-footer-column">
            <h2>General</h2>
            <nav aria-label="General links">
              <Link href="/sign-in">Login</Link>
              <Link href="/sign-up">Sign up</Link>
              <Link href="/pricing">Pricing</Link>
              <Link href="/leaderboard">Leaderboard</Link>
            </nav>
          </div>
          <div className="home-footer-column">
            <h2>Resources</h2>
            <nav aria-label="Resource links">
              <Link href="/help">Help Center</Link>
              <Link href="/templates">Templates</Link>
              <Link href="/discover">Discover</Link>
            </nav>
          </div>
          <div className="home-footer-column">
            <h2>Contact</h2>
            <nav aria-label="Contact links">
              <Link href="/help">Help and support</Link>
              <a href="mailto:snoozersupport@snoozer.uk">Support email</a>
            </nav>
          </div>
          <div className="home-footer-column">
            <h2>Legal</h2>
            <nav aria-label="Legal links">
              <Link href="/terms">Terms of Service</Link>
              <Link href="/privacy">Privacy Policy</Link>
              <Link href="/legal">Legal information</Link>
            </nav>
          </div>
        </div>
        <div className="home-footer-bottom">
          <span>© 2026 Snoozer.uk. All rights reserved.</span>
          <span>A place to be yourself.</span>
        </div>
      </footer>
    </main>
  );
}
