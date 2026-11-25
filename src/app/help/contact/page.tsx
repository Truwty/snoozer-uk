import Link from "next/link";
import { HelpShell } from "@/components/help/help-shell";
import { HelpSearch } from "@/components/help/help-search";

export const metadata = {
  title: "Contact support",
  description: "Contact Snoozer support for account, profile, billing and privacy questions.",
};

const supportEmail = "snoozersupport@snoozer.uk";

const mailto = (subject: string) =>
  `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}`;

export default function HelpContactPage() {
  return (
    <HelpShell>
      <div className="hc-content-toolbar">
        <nav aria-label="Breadcrumb" className="hc-breadcrumb">
          <Link href="/help">Help Centre</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Contact support</span>
        </nav>
        <HelpSearch size="compact" />
      </div>
      <header className="hc-simple-hero hc-contact-hero">
        <p className="hc-eyebrow">SNOOZER SUPPORT</p>
        <h1>Let’s get this <em>sorted.</em></h1>
        <p>Tell us what you need help with. We’ll use the details you provide to understand the issue and get back to you.</p>
      </header>

      <section className="hc-contact-grid" aria-label="Ways to contact Snoozer">
        <article className="hc-contact-card hc-contact-card-primary">
          <span className="hc-contact-icon" aria-hidden="true">✉</span>
          <p className="hc-eyebrow">GENERAL SUPPORT</p>
          <h2>Email the support team</h2>
          <p>For account access, profile editing, technical issues, billing questions and general help.</p>
          <a className="hc-button hc-button-primary" href={mailto("Snoozer support request")}>Email support <span aria-hidden="true">↗</span></a>
          <span className="hc-contact-address">{supportEmail}</span>
        </article>
        <article className="hc-contact-card">
          <span className="hc-contact-icon" aria-hidden="true">⌁</span>
          <p className="hc-eyebrow">PRIVACY & DATA</p>
          <h2>Privacy questions</h2>
          <p>Use the support address for personal-data questions, privacy requests or concerns about information on Snoozer.</p>
          <a className="hc-text-link" href={mailto("Snoozer privacy request")}>Contact about privacy <span aria-hidden="true">↗</span></a>
          <Link href="/privacy" className="hc-secondary-link">Read the Privacy Policy <span aria-hidden="true">→</span></Link>
        </article>
        <article className="hc-contact-card">
          <span className="hc-contact-icon" aria-hidden="true">£</span>
          <p className="hc-eyebrow">PAYMENTS & PLANS</p>
          <h2>Billing support</h2>
          <p>For a payment issue, renewal, cancellation or refund question, include the plan and approximate transaction date.</p>
          <a className="hc-text-link" href={mailto("Snoozer billing question")}>Contact about billing <span aria-hidden="true">↗</span></a>
          <Link href="/help/premium-billing" className="hc-secondary-link">Read the billing guide <span aria-hidden="true">→</span></Link>
        </article>
      </section>

      <section className="hc-contact-guidance">
        <div>
          <p className="hc-eyebrow">HELP US HELP YOU</p>
          <h2>What to include in your message</h2>
          <p>A little context makes it easier to understand what happened.</p>
        </div>
        <ul>
          <li>The email address associated with your Snoozer account.</li>
          <li>The page or feature you were using, including a public profile URL where relevant.</li>
          <li>What you expected to happen and what happened instead.</li>
          <li>The approximate date and time, plus the exact error message if you saw one.</li>
        </ul>
      </section>

      <aside className="hc-security-note">
        <span aria-hidden="true">!</span>
        <div>
          <strong>Keep your account secure</strong>
          <p>Never email your password, one-time sign-in code, recovery code, payment-card number or authentication token. Snoozer support will not need your password.</p>
        </div>
      </aside>
      <div className="hc-contact-back">
        <Link href="/help" className="hc-text-link"><span aria-hidden="true">←</span> Back to the Help Centre</Link>
        <Link href="/legal" className="hc-secondary-link">Business and contact information <span aria-hidden="true">↗</span></Link>
      </div>
    </HelpShell>
  );
}
