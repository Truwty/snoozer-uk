import Link from "next/link";
import { ClaimForm } from "@/components/claim-form";
import { CopyLink } from "@/components/copy-link";
import { Disclosure } from "@/components/ui";
import { Brand } from "@/components/shell";
import { HomeProfileDemo } from "@/components/home-profile-demo";
import { kofiProfileUrl } from "@/lib/kofi-link";

export default function Home() {
  const support = kofiProfileUrl(process.env.KOFI_PLATFORM_PROFILE_URL);
  return <main className="shell home">
    <header className="nav">
      <Brand />
      <nav aria-label="Account" className="actions">
        <Link href="/sign-in" className="button small">Sign in</Link>
        <Link href="/sign-up" className="button small">Get started</Link>
      </nav>
    </header>
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
    <section className="home-section stack" aria-labelledby="free-title"><p className="eyebrow">MAKE A START</p><h2 id="free-title">Start with a Free profile.</h2><p className="muted">Edit your page, choose a theme and publish your links. Your plan and available upgrades are shown in Studio.</p></section>
    <section className="home-section stack" aria-labelledby="faq-title"><h2 id="faq-title">A few things worth knowing</h2>
      <Disclosure title="Can I change my page before publishing?"><p>Studio keeps your draft separate from your published page. Preview your changes, then publish when you are ready.</p></Disclosure>
      <Disclosure title="Do visitors have to allow analytics?"><p>No. Profile analytics are optional. Outbound links work independently of that choice, and embedded players have separate Load and Hide controls.</p></Disclosure>
      <Disclosure title="Can I change my theme later?"><p>Yes. Change your appearance in Studio and check it in the live preview before publishing.</p></Disclosure>
    </section>
    <section className="home-section final-cta"><h2>A place for what you make.</h2><Link className="button" href="/sign-up">Create your page</Link></section>
    <footer className="home-footer"><Brand /><nav className="actions" aria-label="Footer"><Link href="/templates">Templates</Link><a href="#privacy">Privacy</a><a href="#terms">Terms</a><a href="#contact">Contact</a></nav>{support && <a href={support} rel="noreferrer">Support Snoozer on Ko-fi <span aria-hidden="true">↗</span></a>}</footer>
    <section className="policy-notes home-section stack" aria-label="Site information">
      <details id="privacy"><summary>Privacy information — staging draft</summary><div className="stack"><p>Snoozer uses Supabase for accounts, profile data and uploaded files, Render for hosting, Stripe for configured billing, and Ko-fi for support-event integration. Published profile content can be read by visitors. Account sessions are necessary for Studio.</p><p>Optional analytics record daily counts, coarse source/device groups and registered campaign codes. With fresh consent and writable browser storage, a random code is scoped to each profile and UTC day and hashed before database storage. The app does not store your IP address, full referrer or full user agent in its analytics tables. Hosting providers have separate logging policies.</p><p>Profile analytics preferences and player controls are available on published pages. Turning analytics off stops future collection and removes browser codes; previous aggregate counts remain under plan retention. Deleting a profile removes its associated analytics.</p><p>Referral credit is optional at signup and requires email verification within 24 hours. Consented attribution connects an account to the sharing creator until withdrawal or account deletion. Creators see 90-day aggregate counts without names or emails; profile stages are hidden until five verified accounts. Signup referral requests are stored in account metadata; withdrawal clears those fields and retains only an exclusion marker until account deletion. Use Growth in Studio to review or withdraw.</p><p>TODO(owner): add the legal operator, contact details, applicable privacy rights and provider-specific retention before production launch.</p></div></details>
      <details id="terms"><summary>Terms information — staging draft</summary><div className="stack"><p>This staging service is for testing Snoozer. Use only content and links you have permission to publish. Do not upload illegal content, expose other people’s private information or attempt to bypass security controls. Keep a copy of important content.</p><p>Published pages are public. Drafts remain in Studio until you publish. Available quotas and sandbox offers are shown in Plan and usage. Sandbox checkout is for testing and does not represent live billing availability.</p><p>TODO(owner): add operator identity, governing terms, cancellation/refund and complaints details before production launch.</p></div></details>
      <details id="contact"><summary>Contact</summary><div className="stack">{support && <a className="text-link" href={support} rel="noreferrer">Contact through the configured Ko-fi profile</a>}<p>TODO(owner): add a monitored support address and the legal operator’s contact details before production launch.</p></div></details>
    </section>
  </main>;
}
