import Link from "next/link";
import { ClaimForm } from "@/components/claim-form";
import { Disclosure } from "@/components/ui";
import { Brand } from "@/components/shell";
import { SiteHeader } from "@/components/site-header";
import { HomeProfileDemo } from "@/components/home-profile-demo";

export const metadata = {
  title: "Your links, photos and projects in one place",
  description: "Create a personal Snoozer page for your links, photos and projects. Make it yours, then share it anywhere with one Snoozer address.",
};

export default function Home() {
  return <main className="shell home home-redesign">
    <SiteHeader />

    <section className="home-hero" aria-labelledby="home-hero-title">
      <div className="home-hero-pattern" aria-hidden="true">
        <span className="home-pattern-moon home-pattern-moon-one">☾</span>
        <span className="home-pattern-moon home-pattern-moon-two">☾</span>
        <span className="home-pattern-star home-pattern-star-one">✦</span>
        <span className="home-pattern-star home-pattern-star-two">✧</span>
        <span className="home-pattern-star home-pattern-star-three">✦</span>
      </div>
      <div className="home-hero-copy">
        <p className="eyebrow"><span aria-hidden="true">✦</span> YOUR SPACE · YOUR WAY</p>
        <h1 id="home-hero-title">Everything you share,<br /><em>right here.</em></h1>
        <p className="home-hero-lead">A personal page for your links, photos and projects. Make it yours, then share it anywhere with one Snoozer address.</p>
        <div className="home-hero-actions">
          <Link className="button primary" href="/sign-up">Create your page <span aria-hidden="true">↗</span></Link>
          <Link className="button home-hero-secondary" href="/pricing">View pricing</Link>
        </div>
        <p className="home-hero-note">Start with a free page. Make it yours as you go.</p>
      </div>

      <HomeProfileDemo />
      <div className="home-showcase-caption" aria-hidden="true">
        <span><i /> A page that feels like you</span>
        <span>Made in Snoozer Studio</span>
      </div>
    </section>

    <section className="home-highlights" aria-label="What makes Snoozer yours">
      <article className="home-highlight-card">
        <span className="home-highlight-value">01</span>
        <div><h2>One address</h2><p>One simple link for everything you want to share.</p></div>
      </article>
      <article className="home-highlight-card">
        <span className="home-highlight-value">03</span>
        <div><h2>Visual themes</h2><p>Midnight, Lagoon and Daybreak. Pick your look.</p></div>
      </article>
      <article className="home-highlight-card">
        <span className="home-highlight-value">03</span>
        <div><h2>Premium plans</h2><p>Plus, Pro and Studio when you need more room.</p></div>
      </article>
      <article className="home-highlight-card">
        <span className="home-highlight-word">DRAFT</span>
        <div><h2>Publish your way</h2><p>Preview your changes before your page goes live.</p></div>
      </article>
    </section>

    <section className="home-claim" aria-labelledby="home-claim-title">
      <div className="home-claim-copy">
        <p className="eyebrow">MAKE IT YOURS</p>
        <h2 id="home-claim-title">Claim your Snoozer address.</h2>
        <p>Choose a username and give your page a place to call home.</p>
      </div>
      <div className="home-claim-form">
        <ClaimForm hero />
      </div>
    </section>

    <section className="home-plans" aria-labelledby="home-plans-title">
      <header className="home-section-heading">
        <p className="eyebrow">ROOM TO GROW</p>
        <h2 id="home-plans-title">Start free. Make more space when you need it.</h2>
        <p>Begin with a personal page, then choose a Snoozer Premium plan when you want more profiles, storage, links or custom domains.</p>
      </header>
      <div className="home-plan-grid">
        <article className="home-plan-card home-plan-free">
          <div className="home-plan-heading">
            <span className="home-plan-icon" aria-hidden="true">☾</span>
            <p className="eyebrow">A GOOD PLACE TO START</p>
            <h3>Free</h3>
            <p className="home-plan-price"><strong>£0</strong><span>/ always</span></p>
            <p className="home-plan-description">Everything you need to bring your links and ideas together on one page.</p>
          </div>
          <ul className="home-plan-features">
            <li><span aria-hidden="true">✓</span> Create and publish a personal page</li>
            <li><span aria-hidden="true">✓</span> Add links, photos and profile content</li>
            <li><span aria-hidden="true">✓</span> Preview your page before publishing</li>
          </ul>
          <Link className="button home-plan-button" href="/sign-up">Get started for free</Link>
        </article>

        <article className="home-plan-card home-plan-premium">
          <div className="home-plan-featured-label">SNOOZER PREMIUM</div>
          <div className="home-plan-heading">
            <span className="home-plan-icon" aria-hidden="true">✦</span>
            <p className="eyebrow">MORE ROOM FOR WHAT YOU DO</p>
            <h3>Premium</h3>
            <p className="home-plan-price"><strong>From £3</strong><span>/ month</span></p>
            <p className="home-plan-description">Pick the level that fits the way you create. All prices are in GBP.</p>
          </div>
          <div className="home-premium-tiers" role="group" aria-label="Snoozer Premium prices">
            <div><strong>Plus</strong><span>£3 <small>/ mo</small></span><small>£30 / year</small></div>
            <div><strong>Pro</strong><span>£6 <small>/ mo</small></span><small>£60 / year</small></div>
            <div><strong>Studio</strong><span>£12 <small>/ mo</small></span><small>£100 / year</small></div>
          </div>
          <ul className="home-plan-features">
            <li><span aria-hidden="true">✓</span> More profiles and links</li>
            <li><span aria-hidden="true">✓</span> More media storage</li>
            <li><span aria-hidden="true">✓</span> Custom domain allowances</li>
          </ul>
          <Link className="button primary home-plan-button" href="/pricing">Explore all plans <span aria-hidden="true">↗</span></Link>
        </article>
      </div>
      <p className="home-plans-note">Compare monthly and yearly prices, plan limits and billing details on the <Link href="/pricing">Snoozer pricing page</Link>.</p>
    </section>

    <section className="home-faq" aria-labelledby="home-faq-title">
      <header className="home-section-heading">
        <p className="eyebrow">GOOD TO KNOW</p>
        <h2 id="home-faq-title">Frequently asked questions.</h2>
      </header>
      <div className="home-faq-list">
        <Disclosure title="What is Snoozer?">
          <p>Snoozer lets you create a personal page for the links, photos and projects you want to share, all from one address.</p>
        </Disclosure>
        <Disclosure title="Can I start for free?">
          <p>Yes. You can create a free page and start building before choosing whether you need a Premium plan.</p>
        </Disclosure>
        <Disclosure title="Can I change how my page looks?">
          <p>Yes. Choose a theme and layout, add your content, and use the Studio preview to see how your page looks before publishing.</p>
          <p><Link href="/templates">Browse the templates</Link>.</p>
        </Disclosure>
        <Disclosure title="Do I have to publish straight away?">
          <p>No. Your Studio draft is separate from your published page. Make changes and preview them, then publish when you are ready.</p>
        </Disclosure>
        <Disclosure title="Will my profile automatically appear in Discover?">
          <p>No. Discover is opt-in and your directory listing is off by default. You choose whether your profile can appear in public creator discovery.</p>
          <p><Link href="/help">Read the Help Centre</Link>.</p>
        </Disclosure>
        <Disclosure title="Can I upgrade or cancel a Premium plan?">
          <p>Plus, Pro and Studio are available monthly or yearly. Subscribers can manage payment details and cancel future renewals through the billing portal.</p>
          <p><Link href="/help/premium-billing">Read how Premium billing works</Link>.</p>
        </Disclosure>
      </div>
    </section>

    <section className="home-final-cta" aria-labelledby="home-final-title">
      <div className="home-final-decoration" aria-hidden="true"><span>☾</span><i>✦</i><i>✧</i></div>
      <div className="home-final-copy">
        <p className="eyebrow">YOUR SPACE IS WAITING</p>
        <h2 id="home-final-title">A home for everything you make.</h2>
        <p>Bring it together, make it yours and share it with one Snoozer link.</p>
      </div>
      <div className="home-final-actions">
        <Link className="button primary" href="/sign-up">Create your page <span aria-hidden="true">↗</span></Link>
        <Link className="button home-hero-secondary" href="/templates">Explore templates</Link>
      </div>
    </section>

    <footer className="home-footer home-footer-redesign">
      <div className="home-footer-main">
        <div className="home-footer-brand">
          <Brand />
          <p>A place for your links, photos, projects and everything you want to share.</p>
          <a className="home-footer-email" href="mailto:snoozersupport@snoozer.uk">snoozersupport@snoozer.uk</a>
        </div>
        <div className="home-footer-column">
          <h2>General</h2>
          <nav aria-label="General links">
            <Link href="/sign-up">Sign up</Link>
            <Link href="/sign-in">Sign in</Link>
            <Link href="/pricing">Pricing</Link>
          </nav>
        </div>
        <div className="home-footer-column">
          <h2>Explore</h2>
          <nav aria-label="Explore links">
            <Link href="/templates">Templates</Link>
            <Link href="/discover">Discover</Link>
            <Link href="/leaderboard">Leaderboard</Link>
            <Link href="/help">Help Centre</Link>
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
  </main>;
}
