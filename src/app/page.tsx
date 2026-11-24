import Link from "next/link";
import { ClaimForm } from "@/components/claim-form";
import { CopyLink } from "@/components/copy-link";
import { Disclosure } from "@/components/ui";
import { Brand } from "@/components/shell";
import { SiteHeader } from "@/components/site-header";
import { HomeProfileDemo } from "@/components/home-profile-demo";

export const metadata = {
  title: "A place to be yourself",
  description: "Create a personal page for your links, photos and projects, then share it anywhere with one Snoozer address.",
};

export default function Home() {
  return <main className="shell home">
    <SiteHeader />
    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow"><span className="spark" aria-hidden="true">✦</span> LINK IN BIO · PROFILE STUDIO</p>
        <h1>Make yourself<br className="hero-break" /> <em>at home.</em></h1>
        <p className="lead">Give your links, photos and projects a page that feels like you. Share it anywhere with one Snoozer address.</p>
        <ClaimForm hero />
        <Link className="text-link" href="/templates">Browse templates</Link>
      </div>
      <HomeProfileDemo />
    </section>
    <section className="steps" id="how-it-works" aria-label="How Snoozer works">
      <article><div className="step-visual" aria-hidden="true"><span>snoozer.uk/</span><strong>yourname</strong><span className="muted">Choose your handle</span></div><p className="eyebrow">01 / CLAIM</p><h2>Pick your address.</h2><p>Choose a username to give your page a home on Snoozer.</p></article>
      <article><div className="step-visual swatch-options" aria-hidden="true"><span className="demo-swatch" data-theme="midnight" /><span className="demo-swatch" data-theme="lagoon" /><span className="demo-swatch" data-theme="daybreak" /></div><p className="eyebrow">02 / CREATE</p><h2>Make it personal.</h2><p>Add a photo, a short bio and links. Try a theme in the live preview.</p></article>
      <article><div className="step-visual"><span>snoozer.uk</span><CopyLink path="/" /></div><p className="eyebrow">03 / SHARE</p><h2>Take it live.</h2><p>Publish when you’re ready and use the same link wherever you show up.</p></article>
    </section>
    <section className="home-section leaderboard-teaser" aria-labelledby="community-discover-title">
      <div className="stack"><p className="eyebrow">MEET THE COMMUNITY</p><h2 id="community-discover-title">Discover creators.</h2><p className="muted">Explore public profiles from people who have chosen to be listed in Snoozer Discover.</p></div>
      <Link href="/discover" className="button">Explore creators</Link>
    </section>
    <section className="home-section leaderboard-teaser" aria-labelledby="community-leaderboard-title">
      <div className="stack">
        <p className="eyebrow">THE COMMUNITY</p>
        <h2 id="community-leaderboard-title">Leaderboard</h2>
        <p className="muted">Meet the most-viewed Snoozer profiles. Explore the all-time and monthly Top 50.</p>
      </div>
      <Link href="/leaderboard" className="button">Explore the leaderboard</Link>
    </section>
    <section className="home-section stack" aria-labelledby="free-title"><p className="eyebrow">MAKE A START</p><h2 id="free-title">Start with a Free profile.</h2><p className="muted">Edit your page, choose a theme and publish your links. Your plan and available upgrades are shown in Studio.</p></section>
    <section className="home-section stack" aria-labelledby="faq-title"><h2 id="faq-title">A few things worth knowing</h2>
      <Disclosure title="Can I change my page before publishing?"><p>Studio keeps your draft separate from your published page. Preview your changes, then publish when you are ready.</p></Disclosure>
      <Disclosure title="Do visitors have to allow analytics?"><p>No. Profile analytics are optional. Outbound links work independently of that choice, and embedded players have separate Load and Hide controls.</p></Disclosure>
      <Disclosure title="Can I change my theme later?"><p>Yes. Change your appearance in Studio and check it in the live preview before publishing.</p></Disclosure>
    </section>
    <section className="home-section final-cta"><h2>A place for what you make.</h2><Link className="button" href="/sign-up">Create your page</Link></section>
    <footer className="home-footer"><Brand /><nav className="actions" aria-label="Footer"><Link href="/help">Help Center</Link><Link href="/templates">Templates</Link><Link href="/leaderboard">Leaderboard</Link><Link href="/pricing">Pricing</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/legal">Legal information</Link><a href="mailto:snoozersupport@snoozer.uk">Contact</a></nav></footer>
  </main>;
}
