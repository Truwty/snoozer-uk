import Link from "next/link";
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
        <Link href="/sign-up" className="button primary small">Get started</Link>
      </nav>
    </header>
    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow"><span className="spark" aria-hidden="true">✦</span> LINK IN BIO · PROFILE STUDIO</p>
        <h1>Make yourself<br className="hero-break" /> <em>at home.</em></h1>
        <p className="lead">Give your links, photos and projects a page that feels like you. Share it anywhere with one Snoozer address.</p>
        <div className="actions">
          <Link className="button primary" href="/sign-up">Create your page <span aria-hidden="true">↗</span></Link>
          <Link className="button" href="/templates">Browse templates</Link>
        </div>
      </div>
      <HomeProfileDemo />
    </section>
    <section className="steps" id="how-it-works" aria-label="How Snoozer works">
      <article><p className="eyebrow">01 / CLAIM</p><h2>Pick your address.</h2><p>Choose a username to give your page a home on Snoozer.</p></article>
      <article><p className="eyebrow">02 / CREATE</p><h2>Make it personal.</h2><p>Add a photo, a short bio and links. Try a theme in the live preview.</p></article>
      <article><p className="eyebrow">03 / SHARE</p><h2>Take it live.</h2><p>Publish when you’re ready and use the same link wherever you show up.</p></article>
    </section>
    <footer className="home-footer"><Brand />{support && <a href={support} rel="noreferrer">Support Snoozer on Ko-fi <span aria-hidden="true">↗</span></a>}</footer>
  </main>;
}
