import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms and Conditions",
  description: "Terms for creating, publishing and using Snoozer profiles and services.",
  alternates: { canonical: "/terms" },
};

export default function Terms() {
  return <LegalPage title="Terms and Conditions">
    <p className="legal-intro">These terms cover your use of Snoozer. By using the service, you agree to follow them and the laws that apply to you.</p>
    <section className="legal-section stack">
      <h2>Your account</h2>
      <p>Provide accurate account information, keep your sign-in details secure and tell us if you believe your account has been accessed without permission. You are responsible for activity carried out through your account.</p>
    </section>
    <section className="legal-section stack">
      <h2>Your content and public pages</h2>
      <p>You keep ownership of content you create or upload. You confirm that you have the rights and permissions needed to use it and to make it public. To operate Snoozer, you give us permission to host, store, reproduce and display that content as needed to provide the features you choose, including showing a published profile to visitors and generating its preview image. This permission ends when the content is removed from the service, subject to copies or caches outside our control and records we must retain.</p>
      <p>Publishing makes profile content public. You are responsible for reviewing your page before publishing and for keeping a separate copy of anything important.</p>
    </section>
    <section className="legal-section stack">
      <h2>Acceptable use</h2>
      <p>Do not use Snoozer to break the law, infringe another person’s rights, expose private information without permission, distribute harmful or misleading content, interfere with the service, bypass security controls, or upload content you are not allowed to share. Do not misuse links, analytics, referrals, purchases or support features.</p>
      <p>We may restrict or remove content or access where reasonably necessary to protect people, comply with law, investigate abuse or maintain the service. Where appropriate, we will provide an explanation or a way to contact support.</p>
    </section>
    <section className="legal-section stack">
      <h2>Service availability and purchases</h2>
      <p>We work to keep Snoozer available but cannot promise uninterrupted or error-free access. Features may change, be suspended or be discontinued. Plan limits and feature availability are shown in Studio.</p>
      <p>If paid features or purchases are offered, the checkout page and any product-specific terms will explain the price and relevant conditions. Nothing in these terms removes consumer rights that cannot legally be excluded.</p>
    </section>
    <section className="legal-section stack">
      <h2>Snoozer Premium subscriptions</h2>
      <p>Premium Plus, Pro and Studio are optional recurring subscriptions sold by Snoozer, not by other users. The chosen plan, full GBP price and monthly or annual billing frequency are displayed before payment. The subscription renews at the selected interval until you cancel it. Stripe handles payment processing; Snoozer supplies access to the plan and remains responsible for its own customer obligations.</p>
      <p>When subscriptions are available, you can use the Billing Portal in Studio to update your payment method, view invoices and cancel future renewals. Cancellation stops further scheduled renewals and normally leaves access available until the end of your paid period; access may end sooner where a charge is refunded, disputed or reversed. Contact snoozersupport@snoozer.uk if the portal is unavailable or you need help with a refund, cancellation or billing error.</p>
      <p>Snoozer generally does not offer voluntary refunds for subscription charges. This does not remove any refund, remedy or cancellation right you have under the consumer law that applies to your purchase, including any applicable cooling-off rights or rights for services that are faulty or not provided as described. Cancelling future renewals does not, by itself, request a refund for a payment already taken. Email snoozersupport@snoozer.uk if you believe a statutory refund or other remedy applies.</p>
    </section>
    <section className="legal-section stack">
      <h2>Discord integration and Discord API Data</h2>
      <p>Discord is an independent third-party service. Snoozer is not owned, operated, sponsored or endorsed by Discord. If you choose to connect a Discord identity and enable public presence for a published profile, you expressly direct Snoozer to obtain and display the Discord presence fields you select on that profile. These fields may include your online status and, only when you separately enable them, your current activity and custom status. The integration requires your linked Discord account to be a member of the shared Snoozer Discord server.</p>
      <p>Discord presence is optional and is not a Snoozer Premium entitlement. The presence display is provided at no extra charge across Snoozer account tiers. Snoozer does not sell or license Discord API Data, disclose it to advertising networks or data brokers, use it for targeted advertising or marketing, profile Discord users, feed it into Snoozer analytics or referral attribution, or use it to decide eligibility for Premium or other benefits. It is processed only to provide the presence display you explicitly enable.</p>
      <p>Although Snoozer may offer paid subscriptions for unrelated platform features, those subscriptions do not buy, license or grant additional rights in Discord API Data. Discord presence is not a paid benefit, paid add-on, marketing incentive or condition of buying or renewing a Snoozer subscription, and it is provided without a separate charge across account tiers. Snoozer does not receive revenue in exchange for Discord presence data or use it to promote, target or determine eligibility for paid services. This describes how the feature is designed and offered; it does not decide whether Discord regards the wider operation of a subscription service as commercialising API Data under its policies. These terms do not establish Discord approval, and Snoozer may suspend or change the integration if required by Discord or applicable law.</p>
      <p>You can change the fields shown, turn presence off for a profile, or disconnect Discord in Studio. When you withdraw permission or disconnect, Snoozer stops making the affected presence data public and removes cached presence data when no enabled published profile requires it. Account deletion also removes the Discord presence connection and associated cached records, subject to records that we must retain by law. Information already copied, screenshotted or cached by profile visitors or other third parties may remain outside Snoozer’s control.</p>
      <p>Your use of the Discord integration is also subject to Discord’s own <a href="https://support-dev.discord.com/hc/en-us/articles/8562894815383-Discord-Developer-Terms-of-Service" target="_blank" rel="noopener noreferrer">Developer Terms of Service</a> and <a href="https://support-dev.discord.com/hc/en-us/articles/8563934450327-Discord-Developer-Policy" target="_blank" rel="noopener noreferrer">Developer Policy</a>, including their requirements for consent, data minimisation, security, retention, deletion and restrictions on commercialising API Data. Those Discord requirements are separate from these Snoozer terms and take precedence where applicable; these terms do not grant permission from Discord or represent that Discord has approved Snoozer’s use. You must not use the integration to bypass Discord’s privacy controls or Discord’s terms.</p>
      <p>Discord may change, restrict or discontinue API access, privileged intents or its policies. Presence may therefore be delayed, unavailable or disabled. Snoozer does not guarantee that Discord status is uninterrupted, real-time or error-free, and may suspend the integration where necessary to comply with law or Discord’s requirements. Further information about the data Snoozer handles is in our <Link href="/privacy">Privacy Policy</Link>.</p>
    </section>
    <section className="legal-section stack">
      <h2>Liability and changes</h2>
      <p>Snoozer is provided subject to the protections and limits allowed by applicable law. Nothing here excludes liability where exclusion is unlawful, including liability for fraud or for death or personal injury caused by negligence. You remain responsible for your content, links and use of the service.</p>
      <p>We may update these terms as Snoozer changes. The current version will be published on this page. Continued use after an update takes effect means you accept the updated terms to the extent permitted by law.</p>
    </section>
    <section className="legal-section stack">
      <h2>Contact</h2>
      <p>Snoozer is a trading name used by a UK sole trader. For questions about these terms or your subscription, email <a href="mailto:snoozersupport@snoozer.uk">snoozersupport@snoozer.uk</a>. For the trader’s identifying information, see the <Link href="/legal#trader">Business identity and contact</Link> section of the legal information page.</p>
    </section>
  </LegalPage>;
}
