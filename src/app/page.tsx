import "./homepage-immersive.css";
import Link from "next/link";
import { ClaimForm } from "@/components/claim-form";
import { Disclosure } from "@/components/ui";
import { Brand } from "@/components/shell";
import { SiteHeader } from "@/components/site-header";
import { HomeProfileDemo } from "@/components/home-profile-demo";
import { HomeScrollMotion } from "@/components/home-scroll-motion";

export const metadata = {
  title: "Create a page that feels like you",
  description: "Bring your links, photos, projects and socials together on one custom Snoozer profile. Create your page for free.",
};

export default function Home() {
  return (
    <main className="shell home home-immersive">
      <SiteHeader />
      <HomeScrollMotion />

      <section className="home-hero" aria-labelledby="home-hero-title">
        <div className="home-hero-copy">
          <h1 id="home-hero-title">Everything you want, right here.</h1>
          <p className="home-hero-lead">
            Your socials, photos and projects, brought together on one custom Snoozer profile.
          </p>
          <div className="home-hero-actions">
            <Link className="button primary" href="/sign-up">Sign up for free <span aria-hidden="true">↗</span></Link>
            <Link className="button home-secondary-button" href="/pricing">View pricing</Link>
          </div>
          <p className="home-hero-note"><span aria-hidden="true">✓</span> Free to start. Yours to customise.</p>
        </div>
        <HomeProfileDemo />
      </section>

      <section className="home-highlights" aria-label="Snoozer profile features" data-reveal="up">
        <article>
          <span className="home-highlight-icon" aria-hidden="true">↗</span>
          <div><h2>All your links</h2><p>Bring your socials, websites and projects together in one place.</p></div>
        </article>
        <article>
          <span className="home-highlight-icon" aria-hidden="true">✳</span>
          <div><h2>Make it yours</h2><p>Choose your look with themes, layouts, effects and profile widgets.</p></div>
        </article>
        <article>
          <span className="home-highlight-icon" aria-hidden="true">▧</span>
          <div><h2>Show your work</h2><p>Share photos, galleries, projects and the things you create.</p></div>
        </article>
        <article>
          <span className="home-highlight-icon" aria-hidden="true">☾</span>
          <div><h2>One simple link</h2><p>Give people one address for everything you want them to find.</p></div>
        </article>
      </section>

      <section className="home-claim" id="claim" aria-labelledby="home-claim-title" data-reveal="up">
        <div className="home-claim-copy">
          <p className="home-eyebrow">MAKE IT YOURS</p>
          <h2 id="home-claim-title">Claim your own corner of Snoozer.</h2>
          <p>Choose the username people will remember and start building your page.</p>
        </div>
        <div className="home-claim-form"><ClaimForm hero /></div>
      </section>

      <section className="home-plans" id="pricing" aria-labelledby="home-plans-title">
        <header className="home-section-heading" data-reveal="up">
          <p className="home-eyebrow">START FREE. GROW WHEN YOU&apos;RE READY.</p>
          <h2 id="home-plans-title">Your page first.<br /><em>More room when you need it.</em></h2>
          <p>Build your profile for free, then choose a Premium plan when you want more tools and room to grow.</p>
        </header>
        <div className="home-plan-grid">
          <article className="home-plan-card home-plan-free" data-reveal="up">
            <div className="home-plan-heading">
              <p className="home-plan-kicker">THE STARTING POINT</p>
              <h3>Free</h3>
              <p className="home-plan-price">£0 <span>/ always</span></p>
              <p className="home-plan-description">Everything you need to create and share your own profile.</p>
            </div>
            <ul className="home-plan-features">
              <li><span aria-hidden="true">✓</span> Create and publish a personal page</li>
              <li><span aria-hidden="true">✓</span> Add links and profile content</li>
              <li><span aria-hidden="true">✓</span> Start customising your page</li>
            </ul>
            <Link className="button" href="/sign-up">Get started free <span aria-hidden="true">↗</span></Link>
          </article>

          <article className="home-plan-card home-plan-premium" data-reveal="up">
            <div className="home-plan-heading">
              <p className="home-plan-kicker">UNLOCK MORE POSSIBILITIES</p>
              <h3>Snoozer Premium</h3>
              <p className="home-plan-description">More ways to build, customise and grow your online space.</p>
            </div>
            <div className="home-premium-tiers" aria-label="Snoozer Premium prices">
              <div><span>PLUS</span><strong>£3<small>/mo</small></strong><small>£30 / year</small></div>
              <div><span>PRO</span><strong>£6<small>/mo</small></strong><small>£60 / year</small></div>
              <div><span>STUDIO</span><strong>£12<small>/mo</small></strong><small>£100 / year</small></div>
            </div>
            <ul className="home-plan-features">
              <li><span aria-hidden="true">✓</span> More profile customisation</li>
              <li><span aria-hidden="true">✓</span> Additional profile and media options</li>
              <li><span aria-hidden="true">✓</span> Tools for creators who want more</li>
            </ul>
            <Link className="button primary" href="/pricing">Explore Premium <span aria-hidden="true">↗</span></Link>
          </article>
        </div>
        <p className="home-plans-note">All prices are in GBP. <Link href="/pricing">See plan limits and billing details.</Link></p>
      </section>

      <section className="home-faq" aria-labelledby="home-faq-title">
        <header className="home-section-heading" data-reveal="up">
          <h2 id="home-faq-title">Frequently Asked Questions</h2>
        </header>
        <div className="home-faq-list" data-reveal="up">
          <Disclosure title="What is Snoozer?">
            <p>Snoozer lets you create a personal page for the links, photos and projects you want to share, all from one address.</p>
          </Disclosure>
          <Disclosure title="Can I start for free?">
            <p>Yes. You can create and publish a free page, then upgrade later if you need more features.</p>
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

      <section className="home-final-cta" data-reveal="up" aria-labelledby="home-final-title">
        <div>
          <p className="home-eyebrow">READY WHEN YOU ARE</p>
          <h2 id="home-final-title">Make your page.<br /><em>Make it yours.</em></h2>
          <p>Everything you want to share, together in one place.</p>
        </div>
        <Link className="button primary" href="/sign-up">Create your page <span aria-hidden="true">↗</span></Link>
      </section>

      <footer className="home-footer home-footer-redesign">
        <div className="home-footer-main">
          <div className="home-footer-brand">
            <Brand />
            <p>Your links, your work and everything you want to share. All in one place.</p>
            <a className="home-footer-email" href="mailto:snoozersupport@snoozer.uk">snoozersupport@snoozer.uk</a>
          </div>
          <div className="home-footer-column">
            <h2>Get started</h2>
            <nav aria-label="Get started links">
              <Link href="/sign-up">Create an account</Link>
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
    </main>
  );
}
