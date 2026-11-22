import type { Metadata } from "next";
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
      <h2>Liability and changes</h2>
      <p>Snoozer is provided subject to the protections and limits allowed by applicable law. Nothing here excludes liability where exclusion is unlawful, including liability for fraud or for death or personal injury caused by negligence. You remain responsible for your content, links and use of the service.</p>
      <p>We may update these terms as Snoozer changes. The current version will be published on this page. Continued use after an update takes effect means you accept the updated terms to the extent permitted by law.</p>
    </section>
    <section className="legal-section stack">
      <h2>Contact</h2>
      <p>Snoozer is a trading name used by a UK sole trader. For questions about these terms or your subscription, email <a href="mailto:snoozersupport@snoozer.uk">snoozersupport@snoozer.uk</a>. For the trader’s identifying information, see the <a href="/legal#trader">Business identity and contact</a> section of the legal information page.</p>
    </section>
  </LegalPage>;
}
