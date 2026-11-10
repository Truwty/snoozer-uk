import Link from "next/link";
import { Brand } from "@/components/shell";

export default function Home() {
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
        <p className="eyebrow"><span className="spark" aria-hidden="true">✦</span> YOUR CORNER OF THE INTERNET</p>
        <h1>Make yourself<br className="hero-break" /> <em>at home.</em></h1>
        <p className="lead">Give your work, socials and favourite things one address. Make it feel like you, then share it anywhere.</p>
        <div className="actions">
          <Link className="button primary" href="/sign-up">Create your page <span aria-hidden="true">↗</span></Link>
          <Link className="button" href="/templates">Browse templates</Link>
          <a className="button" href="#how-it-works">How it works</a>
        </div>
      </div>
      <div className="hero-art" aria-hidden="true">
        <div className="orbit orbit-outer" /><div className="orbit orbit-inner" />
        <div className="orb"><div className="orb-lines" /></div>
        <span className="art-star">✧</span><span className="art-star small-star">+</span>
        <div className="art-coordinates"><span>FIG. 01</span><span>PERSONAL SPACE</span></div>
      </div>
    </section>
    <section className="steps" id="how-it-works" aria-label="How Snoozer works">
      <article><p className="eyebrow">01 / CLAIM</p><h2>Pick your address.</h2><p>Choose a username to give your page a home on Snoozer.</p></article>
      <article><p className="eyebrow">02 / CREATE</p><h2>Make it personal.</h2><p>Add a photo, a short bio and links. Try a theme in the live preview.</p></article>
      <article><p className="eyebrow">03 / SHARE</p><h2>Take it live.</h2><p>Publish when you’re ready and use the same link wherever you show up.</p></article>
    </section>
    <footer className="home-footer"><Brand /><span>A little more you.</span></footer>
  </main>;
}
