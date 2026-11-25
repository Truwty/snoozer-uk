import Image from "next/image";
import Link from "next/link";
import { ClaimForm } from "@/components/claim-form";
import { Disclosure } from "@/components/ui";
import { Brand } from "@/components/shell";
import { SiteHeader } from "@/components/site-header";
import { HomeProfileDemo } from "@/components/home-profile-demo";
import { HomeScrollMotion } from "@/components/home-scroll-motion";

export const metadata = {
  title: "Your corner of the internet, all in one place",
  description: "Build a personal Snoozer page for your links, photos, projects and everything you want to share. Make it yours, then share it with one link.",
};

const photos = {
  artistStudio: "https://images.unsplash.com/photo-1765758014805-a7a6cc272982?auto=format&fit=crop&w=1500&q=85",
  creatorStudio: "https://images.unsplash.com/photo-1637249786345-a064129dd0d2?auto=format&fit=crop&w=1500&q=85",
  darkDesk: "https://images.unsplash.com/photo-1510519138101-570d1dca3d66?auto=format&fit=crop&w=1200&q=85",
};

export default function Home() {
  return <main className="shell home home-immersive">
    <SiteHeader />
    <HomeScrollMotion />

    <section className="hi-hero" aria-labelledby="hi-hero-title">
      <div className="hi-hero-copy">
        <p className="hi-eyebrow"><span aria-hidden="true">✳</span> YOUR SPACE. YOUR RULES.</p>
        <h1 id="hi-hero-title">Everything you are.<br /><em>In one place.</em></h1>
        <p className="hi-hero-lead">Your links, photos, projects and all the things that make you, you. Bring them together on one page that feels like yours.</p>
        <div className="hi-hero-actions">
          <Link className="button primary hi-button-primary" href="/sign-up">Create your page <span aria-hidden="true">↗</span></Link>
          <Link className="hi-text-link" href="/templates">See what you can make <span aria-hidden="true">↓</span></Link>
        </div>
        <p className="hi-hero-footnote"><span aria-hidden="true">☾</span> Start with Free. Make it yours as you go.</p>
      </div>
      <figure className="hi-hero-visual" data-reveal="hero">
        <Image src="https://images.unsplash.com/photo-1758613655800-98248330920d?auto=format&fit=crop&w=2000&q=88"
          alt="A photographer directs a model during a studio photoshoot." fill priority unoptimized sizes="(max-width: 760px) 100vw, 58vw" />
        <div className="hi-hero-image-shade" aria-hidden="true" />
        <figcaption className="hi-hero-caption">
          <span>01 / MAKE AN ENTRANCE</span>
          <a href="https://unsplash.com/photos/photographer-directing-male-model-in-studio-lighting-N0y2ZSdm57c" target="_blank" rel="noreferrer">Photo by Vitaly Gariev ↗</a>
        </figcaption>
        <div className="hi-hero-stamp" aria-hidden="true">
          <span>YOUR WORLD</span><strong>One address.<br />All of you.</strong><i>✳</i>
        </div>
      </figure>
    </section>

    <div className="hi-marquee" aria-hidden="true">
      <div className="hi-marquee-track" aria-hidden="true">
        {Array.from({ length: 2 }).map((_, index) => <span className="hi-marquee-group" key={index}>
          <b>YOUR LINKS</b><i>✳</i><b>YOUR WORK</b><i>✳</i><b>YOUR PHOTOS</b><i>✳</i><b>YOUR WORLD</b><i>✳</i>
        </span>)}
      </div>
    </div>

    <section className="hi-intro" data-reveal="up" aria-labelledby="hi-intro-title">
      <div className="hi-intro-heading">
        <p className="hi-eyebrow">A LITTLE SPACE THAT SAYS A LOT</p>
        <h2 id="hi-intro-title">Not just another link.<br /><em>A place that feels like you.</em></h2>
      </div>
      <div className="hi-intro-aside">
        <p>Give people somewhere to land. Put the things you make, the places you post and the projects you care about together, without squeezing yourself into somebody else&apos;s template.</p>
        <Link className="hi-text-link" href="/templates">Find your starting point <span aria-hidden="true">↗</span></Link>
      </div>
    </section>

    <section className="hi-photo-grid" aria-label="Real photography showing creative spaces and work">
      <figure className="hi-photo hi-photo-main" data-reveal="up">
        <Image src={photos.artistStudio} alt="An artist's workspace with a computer, posters and artwork covering the wall." fill unoptimized sizes="(max-width: 760px) 100vw, 60vw" />
        <div className="hi-photo-shade" aria-hidden="true" />
        <figcaption>
          <span>01 — YOUR WORK, YOUR WAY</span>
          <strong>Make room for what you make.</strong>
          <a href="https://unsplash.com/photos/a-cluttered-desk-with-a-computer-and-artwork-jZQO3inAPe4" target="_blank" rel="noreferrer">Photo by Orlando García ↗</a>
        </figcaption>
      </figure>
      <figure className="hi-photo hi-photo-top" data-reveal="up">
        <Image src={photos.creatorStudio} alt="A creator working in a blue-lit filming and editing studio." fill unoptimized sizes="(max-width: 760px) 100vw, 40vw" />
        <div className="hi-photo-shade" aria-hidden="true" />
        <figcaption>
          <span>02 — YOUR PROJECTS</span><strong>Show what you&apos;re building.</strong>
          <a href="https://unsplash.com/photos/a-man-standing-at-a-desk-in-front-of-a-camera-ypCEZV7i0eg" target="_blank" rel="noreferrer">Photo by Jakob Owens ↗</a>
        </figcaption>
      </figure>
      <figure className="hi-photo hi-photo-bottom" data-reveal="up">
        <Image src={photos.darkDesk} alt="A calm, dark creative desk setup with a monitor, keyboard and plant." fill unoptimized sizes="(max-width: 760px) 100vw, 40vw" />
        <div className="hi-photo-shade" aria-hidden="true" />
        <figcaption>
          <span>03 — YOUR EVERYDAY</span><strong>Keep it all close.</strong>
          <a href="https://unsplash.com/photos/a-desk-with-a-computer-monitor-and-keyboard-on-it-OVbeSXRk_9E" target="_blank" rel="noreferrer">Photo by Nikita Kachanovsky ↗</a>
        </figcaption>
      </figure>
    </section>

    <section className="hi-reasons" aria-label="What makes a Snoozer page yours">
      <article data-reveal="up"><span className="hi-reason-number">01</span><h3>Look like yourself.</h3><p>Choose Midnight, Lagoon or Daybreak. Set the mood, pick your layout and make the page feel right.</p></article>
      <article data-reveal="up"><span className="hi-reason-number">02</span><h3>Bring it together.</h3><p>Give your links, photos, widgets and projects one home instead of sending people all over the place.</p></article>
      <article data-reveal="up"><span className="hi-reason-number">03</span><h3>Publish when you&apos;re ready.</h3><p>Work in your draft, preview the result and put it live when it feels like you.</p></article>
    </section>

    <section className="hi-studio" aria-labelledby="hi-studio-title">
      <div className="hi-studio-copy" data-reveal="up">
        <p className="hi-eyebrow">A LIVE LOOK AT SNOOZER STUDIO</p>
        <h2 id="hi-studio-title">The details make<br /><em>the difference.</em></h2>
        <p>Try a different theme or layout. Your preview changes as you do, so you can find the right feel before anything goes live.</p>
        <Link className="hi-text-link" href="/studio">Make it yours in Studio <span aria-hidden="true">↗</span></Link>
      </div>
      <HomeProfileDemo />
    </section>

    <section className="hi-claim" aria-labelledby="hi-claim-title" data-reveal="up">
      <div className="hi-claim-copy">
        <p className="hi-eyebrow">MAKE IT OFFICIAL</p>
        <h2 id="hi-claim-title">Claim your little corner of the internet.</h2>
        <p>Choose the address people will remember. Your page starts here.</p>
      </div>
      <div className="hi-claim-form"><ClaimForm hero /></div>
      <span className="hi-claim-orbit" aria-hidden="true">☾</span>
    </section>

    <section className="hi-pricing" aria-labelledby="hi-pricing-title">
      <header className="hi-section-heading" data-reveal="up">
        <p className="hi-eyebrow">NO PRESSURE. ROOM TO GROW.</p>
        <h2 id="hi-pricing-title">Start free.<br /><em>Upgrade when it makes sense.</em></h2>
        <p>Make your page first. Add more space and tools when you actually need them.</p>
      </header>
      <div className="hi-pricing-grid">
        <article className="hi-price-free" data-reveal="up">
          <div><p className="hi-price-kicker">THE STARTING POINT</p><h3>Free</h3><p className="hi-price-value">£0 <span>/ always</span></p><p className="hi-price-description">Everything you need to put your links and ideas in one place.</p></div>
          <ul><li><span>✳</span> Create and publish a personal page</li><li><span>✳</span> Add links, photos and profile content</li><li><span>✳</span> Preview before publishing</li></ul>
          <Link className="hi-text-link" href="/sign-up">Start for free <span aria-hidden="true">↗</span></Link>
        </article>
        <article className="hi-price-premium" data-reveal="up">
          <div className="hi-premium-heading">
            <div><p className="hi-price-kicker">WHEN YOU WANT MORE</p><h3>Snoozer Premium</h3><p className="hi-price-description">Pick the plan that fits what you&apos;re building.</p></div>
            <span className="hi-price-spark" aria-hidden="true">✳</span>
          </div>
          <div className="hi-premium-tiers" aria-label="Snoozer Premium prices">
            <div><span>PLUS</span><strong>£3<small>/mo</small></strong><small>£30 / year</small></div>
            <div><span>PRO</span><strong>£6<small>/mo</small></strong><small>£60 / year</small></div>
            <div><span>STUDIO</span><strong>£12<small>/mo</small></strong><small>£100 / year</small></div>
          </div>
          <ul><li><span>✳</span> More profiles and links</li><li><span>✳</span> More media storage</li><li><span>✳</span> Custom domain allowances</li></ul>
          <Link className="button primary hi-button-primary" href="/pricing">Compare all plans <span aria-hidden="true">↗</span></Link>
        </article>
      </div>
      <p className="hi-pricing-note">All prices are in GBP. <Link href="/pricing">See full plan limits and billing details.</Link></p>
    </section>

    <section className="hi-faq" aria-labelledby="hi-faq-title">
      <header className="hi-section-heading" data-reveal="up">
        <p className="hi-eyebrow">THE QUICK ANSWERS</p><h2 id="hi-faq-title">A few things you<br /><em>might be wondering.</em></h2>
      </header>
      <div className="hi-faq-list" data-reveal="up">
        <Disclosure title="What is Snoozer?"><p>Snoozer lets you create a personal page for the links, photos and projects you want to share, all from one address.</p></Disclosure>
        <Disclosure title="Can I start for free?"><p>Yes. You can create a free page and start building before choosing whether you need a Premium plan.</p></Disclosure>
        <Disclosure title="Can I change how my page looks?"><p>Yes. Choose a theme and layout, add your content, and use the Studio preview to see how your page looks before publishing.</p><p><Link href="/templates">Browse the templates</Link>.</p></Disclosure>
        <Disclosure title="Do I have to publish straight away?"><p>No. Your Studio draft is separate from your published page. Make changes and preview them, then publish when you are ready.</p></Disclosure>
        <Disclosure title="Will my profile automatically appear in Discover?"><p>No. Discover is opt-in and your directory listing is off by default. You choose whether your profile can appear in public creator discovery.</p><p><Link href="/help">Read the Help Centre</Link>.</p></Disclosure>
        <Disclosure title="Can I upgrade or cancel a Premium plan?"><p>Plus, Pro and Studio are available monthly or yearly. Subscribers can manage payment details and cancel future renewals through the billing portal.</p><p><Link href="/help/premium-billing">Read how Premium billing works</Link>.</p></Disclosure>
      </div>
    </section>

    <section className="hi-final" aria-labelledby="hi-final-title" data-reveal="up">
      <Image src={photos.creatorStudio} alt="" fill unoptimized sizes="100vw" aria-hidden="true" />
      <div className="hi-final-shade" aria-hidden="true" />
      <div className="hi-final-content">
        <p className="hi-eyebrow">IT STARTS WITH ONE LINK</p>
        <h2 id="hi-final-title">Make somewhere<br /><em>that feels like yours.</em></h2>
        <p>Bring the things you share into one place. The rest is yours to make.</p>
        <Link className="button primary hi-button-primary" href="/sign-up">Create your page <span aria-hidden="true">↗</span></Link>
      </div>
      <a className="hi-final-credit" href="https://unsplash.com/photos/a-man-standing-at-a-desk-in-front-of-a-camera-ypCEZV7i0eg" target="_blank" rel="noreferrer">Photo by Jakob Owens ↗</a>
    </section>

    <footer className="hi-footer">
      <div className="hi-footer-main">
        <div className="hi-footer-brand"><Brand /><p>A little home for the things you want the world to see.</p><a href="mailto:snoozersupport@snoozer.uk">snoozersupport@snoozer.uk</a></div>
        <div className="hi-footer-column"><h2>Get started</h2><nav aria-label="Get started links"><Link href="/sign-up">Create an account</Link><Link href="/sign-in">Sign in</Link><Link href="/pricing">Pricing</Link></nav></div>
        <div className="hi-footer-column"><h2>Explore</h2><nav aria-label="Explore links"><Link href="/templates">Templates</Link><Link href="/discover">Discover</Link><Link href="/leaderboard">Leaderboard</Link><Link href="/help">Help Centre</Link></nav></div>
        <div className="hi-footer-column"><h2>The details</h2><nav aria-label="Legal links"><Link href="/terms">Terms of Service</Link><Link href="/privacy">Privacy Policy</Link><Link href="/legal">Legal information</Link></nav></div>
      </div>
      <div className="hi-footer-bottom"><span>© 2026 Snoozer.uk. All rights reserved.</span><span>Yours to make. Yours to share.</span></div>
    </footer>
  </main>;
}
