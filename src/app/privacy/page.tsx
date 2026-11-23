import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { PrivacyPreferencesButton } from "@/components/cookie-consent";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Learn what Snoozer collects, how it is used, and how to manage your privacy choices.",
  alternates: { canonical: "/privacy" },
};

export default function Privacy() {
  return <LegalPage title="Privacy Policy">
    <p className="legal-intro">This policy explains how Snoozer handles information when you create an account, publish a profile, or visit a Snoozer page.</p>
    <section className="legal-section stack">
      <h2>Information we handle</h2>
      <ul>
        <li><strong>Account information:</strong> your email address and account/session data needed to sign in and protect your account.</li>
        <li><strong>Profile information:</strong> the username you claim, profile text, links, appearance settings, images and other content you add. Published pages are public and can be copied or indexed by others.</li>
        <li><strong>Optional analytics:</strong> only after consent, Snoozer records profile views, link clicks, coarse traffic-source and device groups, and registered campaign codes. A random browser code is scoped to one profile and one UTC day and is hashed before it is stored. The analytics tables do not store your IP address, full referrer or full user agent. Turning analytics off stops future collection and removes browser codes; previously recorded aggregate counts may remain.</li>
        <li><strong>Referrals:</strong> if you choose to use a referral code, signup attribution is stored with your account. Creators see aggregate counts rather than names or email addresses. You can withdraw attribution in Studio; withdrawal clears the attribution details and keeps only an exclusion marker until account deletion.</li>
        <li><strong>Embedded Spotify music:</strong> where a creator publishes a Spotify track, album, playlist or podcast, the official Spotify player loads as you reach it. Your browser contacts Spotify directly; Spotify may receive your IP address, device/browser information and set or access its own cookies under its own privacy policy. Snoozer does not obtain your Spotify account credentials.</li>
        <li><strong>Optional Discord presence:</strong> if you link a Discord identity and enable public presence on a profile, Snoozer stores your Discord account ID and a short-lived snapshot of the status and activity fields you select. Custom status is off by default. Snoozer’s bot filters Gateway events to linked, opted-in accounts in the shared Snoozer Discord server; it does not store messages, private-channel content, friends or party secrets. The current snapshot is no longer displayed after ten minutes without a refresh and is purged on the next worker sync; it is removed immediately when you disconnect, disable all published presence profiles, unpublish the last enabled profile or delete your account. Visitors can see the selected fields on the published profile. Presence is not used for advertising, profiling, Snoozer analytics, referral attribution or Premium eligibility. Its use is also subject to Discord’s <a href="https://support-dev.discord.com/hc/en-us/articles/8562894815383-Discord-Developer-Terms-of-Service" target="_blank" rel="noopener noreferrer">Developer Terms</a> and <a href="https://support-dev.discord.com/hc/en-us/articles/8563934450327-Discord-Developer-Policy" target="_blank" rel="noopener noreferrer">Developer Policy</a>.</li>
        <li><strong>Interactive profile widgets:</strong> when you submit a Guestbook message, Snoozer processes the display name and message you provide. Messages are private while pending and appear publicly only if the profile owner approves them. Owners can reject or delete submissions. Approved and pending messages remain until removed by the owner or the profile/account is deleted; rejected messages older than 30 days are removed during later submission maintenance. When you submit a Guestbook message or vote in a poll, your browser creates a random widget token in local storage. Snoozer stores only its SHA-256 hash with the interaction record to apply per-browser submission and voting limits. The token is not used for analytics or advertising. A poll records the selected option, poll identifier, hashed token and submission time; public results are aggregate vote counts. This is a browser-level abuse control, not proof of a unique person, and clearing browser storage or using another browser can permit another vote. Widget interaction records do not store visitor IP addresses; hosting and database providers may retain separate technical request logs under their own policies. FAQ answers and creator-curated testimonials are profile content and are public when published.</li>
        <li><strong>Service and security data:</strong> requests and operational records needed to host the service, prevent abuse, support accounts and fulfil any enabled purchase or support flow. Hosting and service providers may process their own technical logs under their policies.</li>
      </ul>
    </section>
    <section className="legal-section stack">
      <h2>Cookies and browser storage</h2>
      <p>Essential sign-in storage is used to keep accounts working. Snoozer does not use advertising cookies. Optional profile analytics use browser storage rather than an analytics cookie and remain off until you allow them. Your browser’s Do Not Track or Global Privacy Control signal keeps optional analytics off. Spotify music embeds are separate third-party content; they can contact Spotify and use its own browser storage even while Snoozer analytics are off.</p>
      <PrivacyPreferencesButton />
    </section>
    <section className="legal-section stack">
      <h2>How information is used and shared</h2>
      <p>We use information to provide accounts and profiles, display content you publish, operate optional analytics, respond to support requests, secure the service and meet legal obligations. Information is shared with providers needed to run features, including Supabase for authentication, database and file storage, Render for hosting, and Stripe or Ko-fi when their relevant payment or support integrations are enabled. These providers process information under their own terms and privacy notices. Published Spotify players contact Spotify directly when rendered, subject to <a href="https://www.spotify.com/legal/privacy-policy/" target="_blank" rel="noopener noreferrer">Spotify&apos;s privacy policy</a>.</p>
      <p>We do not sell personal information or use it for targeted advertising. Information may also be disclosed where required by law or needed to protect users and the service.</p>
    </section>
    <section className="legal-section stack">
      <h2>Retention and your choices</h2>
      <p>Account, profile and operational records are kept for as long as needed to provide and protect the service. Deleting a profile removes its associated analytics; account deletion removes account data subject to limited records that must be kept for security, accounting or legal purposes. Published content may have been copied or cached by third parties, which Snoozer cannot remove from their systems.</p>
      <p>You can edit or unpublish profile content in Studio, turn off analytics in your privacy settings or on a public profile, and withdraw referral attribution in Studio. Depending on the privacy law that applies to you, you may also have rights to access, correct, delete, restrict or object to certain processing. Contact us to make a request.</p>
    </section>
    <section className="legal-section stack">
      <h2>Security and contact</h2>
      <p>We use technical and organisational safeguards appropriate to the service, but no online service can guarantee absolute security. For privacy questions or requests, email <a href="mailto:snoozersupport@snoozer.uk">snoozersupport@snoozer.uk</a>.</p>
      <p>Snoozer may update this policy as the service changes. The current version will be published on this page.</p>
    </section>
  </LegalPage>;
}
