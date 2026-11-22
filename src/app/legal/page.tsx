import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Legal information and business disclosures",
  description: "Snoozer's legal information, service disclosures, subscription policies and trader contact details.",
  alternates: { canonical: "/legal" },
  // Disclosures remain public, accessible and linked, without asking search engines
  // to catalogue a sole trader's personal name unnecessarily.
  robots: { index: false, follow: true },
};

const sections = [
  {
    id: "about",
    title: "01. About this legal notice",
    paragraphs: [
      "This page explains the operator of Snoozer, the nature of the service and important information about use, subscriptions and support. It complements, rather than replaces, our Terms and Conditions and Privacy Policy. Read all three documents when deciding whether to create an account, publish a profile or buy a subscription.",
      "Snoozer is a service for creating, customising and publishing personal pages. Features include public links, profile designs and other optional tools made available through Studio. Availability and plan limits can change over time; the plan-selection screen identifies the features currently offered.",
    ],
  },
  {
    id: "scope",
    title: "02. Service and geographic scope",
    paragraphs: [
      "The service is operated from the United Kingdom and is accessible over the internet. A person accessing Snoozer from another country is responsible for complying with laws applicable to their own use, including laws concerning content they submit and external services they link.",
      "Availability in a country does not mean that paid subscriptions are automatically available there. Paid Checkout may remain disabled or be restricted while applicable consumer disclosures, taxes, billing and payment arrangements are being reviewed.",
    ],
  },
  {
    id: "accounts",
    title: "03. Accounts, eligibility and security",
    paragraphs: [
      "You are responsible for providing accurate information when registering and for keeping account access confidential. You should use your own account and should not share passwords, recovery codes or authenticated sessions with other people.",
      "Where available, multiple saved sessions may be managed in one browser. Account switching is intended for your own accounts, not as a means of delegating access. Access can end when a session expires, credentials change or a provider invalidates a token.",
      "If you suspect unauthorised access, change your credentials, review linked sign-in methods and contact Snoozer support. We may restrict an account when reasonably necessary to investigate security issues or comply with legal obligations.",
    ],
  },
  {
    id: "profiles",
    title: "04. Drafts, public profiles and publication",
    paragraphs: [
      "Your Studio draft is distinct from your published page. When you choose to publish, the information you have selected for publication becomes available to visitors with the relevant URL and may be indexed, shared, saved or reproduced outside Snoozer.",
      "Review usernames, photographs, biographies, links, embeds and background images before publication. You should not publish confidential data or personal information about another person without an appropriate basis to do so.",
      "Unpublishing or deleting material can stop Snoozer from serving it, but it cannot erase copies retained by search engines, caches, screenshots or third parties.",
    ],
  },
  {
    id: "ownership",
    title: "05. Content ownership and permission to host",
    paragraphs: [
      "You retain the rights you hold in material you submit. By using the publishing service, you allow Snoozer to store, process, resize, host and display that material as needed to deliver the features and publication settings you choose.",
      "You must have permission to upload and publish every image, audio or video reference, trademark, description and other item of content that you use. Uploading content does not transfer third-party rights to you.",
      "If we receive a credible allegation that material infringes rights or violates applicable rules, we may temporarily restrict it while reviewing the matter. Contact support with the relevant page address and a clear explanation if you need to report a problem.",
    ],
  },
  {
    id: "conduct",
    title: "06. Prohibited use and moderation",
    paragraphs: [
      "Do not use Snoozer to distribute malware, phishing links or fraudulent offers; harass, threaten or impersonate others; publish unlawful personal data; bypass access controls; manipulate visitor analytics; or interfere with availability, security or other users.",
      "Snoozer may act on credible reports, suspicious automated behaviour, legal requests and service-integrity concerns. Actions can include removing individual links, unpublishing pages, limiting features or suspending accounts. Any review or appeal process available at the time will be communicated through the relevant support channel.",
    ],
  },
  {
    id: "privacy",
    title: "07. Personal data, storage and privacy",
    paragraphs: [
      "Authentication, account profiles, customer support and other service operations require processing information relevant to the requested functionality. Our Privacy Policy describes the categories of information involved, service providers, retention practices and your choices.",
      "Profile analytics are optional where the service requires visitor consent. Declining optional analytics should not prevent visitors from using ordinary public links. Cookies or equivalent storage needed for secure sign-in and core functionality may still be used.",
      "For data-access, correction or deletion questions, send your request from the relevant account email where possible so the request can be checked without exposing another person's information.",
    ],
  },
  {
    id: "third-party",
    title: "08. External links, embeds and providers",
    paragraphs: [
      "Published pages can include links to services outside Snoozer. Those destinations operate under their own policies, security controls, privacy practices and availability. Snoozer does not endorse every external destination and is not responsible for its independent content or actions.",
      "Features may rely on external infrastructure, including authentication, hosting, storage and, when enabled, a payment processor. Providers may process data necessary to deliver the relevant feature. Consult the Privacy Policy and the provider's notices for additional information.",
    ],
  },
  {
    id: "plans",
    title: "09. Free service and Premium plan information",
    paragraphs: [
      "Snoozer offers a free level of service and may offer paid recurring Premium subscriptions named Plus, Pro and Studio. The Pricing page identifies the current GBP price, monthly or annual interval and broad feature allowances for each tier.",
      "A public pricing comparison is not a guarantee that paid subscriptions are presently available. A customer is not charged for browsing a plan page or selecting a comparison option. Checkout must be explicitly completed through the payment provider when it is available.",
      "Before paying, review the plan, recurring interval, total amount due and any applicable terms. Features and allowances can be modified subject to the contract and mandatory consumer protections.",
    ],
  },
  {
    id: "payments",
    title: "10. Payment processing and transaction records",
    paragraphs: [
      "When Premium Checkout is enabled, Stripe processes payment information and supports the customer-facing billing portal. Snoozer remains the operator supplying the Premium features. Payment processing does not make Stripe the seller of Snoozer subscriptions.",
      "Payment success is not inferred solely from returning to a Snoozer page. Access depends on the provider's verified payment and subscription records being processed and matched to the right account.",
      "Depending on applicable requirements, payment confirmations, invoices and other business documentation may include the identity of the sole trader and an address for service of documents. See the Business identity and contact section for the trader details made available on this website.",
    ],
  },
  {
    id: "renewals",
    title: "11. Renewal, cancellation and access",
    paragraphs: [
      "Subscriptions ordinarily recur at the monthly or yearly interval selected at Checkout until cancelled. The billing portal, when configured, is used to manage payment details and future renewals. Cancelling a subscription prevents later scheduled charges but normally does not automatically reverse an amount already paid.",
      "Premium features generally continue until the end of the verified paid billing period after cancellation, unless an applicable contractual or legal circumstance requires a different result. Refunded, reversed, disputed or fraudulent payments can affect the associated entitlement.",
      "Contact support if the billing portal is unavailable, if your account is incorrectly shown as unpaid or if a confirmed charge has not produced the expected Premium access.",
    ],
  },
  {
    id: "refunds",
    title: "12. Refunds and consumer cancellation rights",
    paragraphs: [
      "Snoozer does not generally offer voluntary refunds of Premium subscription charges. This policy is subject to mandatory consumer protections. Nothing on this page excludes a right to a refund, remedy or cancellation that applicable law provides.",
      "The availability and duration of withdrawal or cooling-off rights can depend on the consumer's location, the type of digital service, information supplied before the order and whether performance began with the consumer's agreement. Snoozer will assess requests under the rules applicable to the transaction, not merely against the words 'non-refundable'.",
      "For a possible statutory refund, billing error or cancellation-right issue, email support with your account email, the approximate payment date and the relevant transaction reference if available. Never send complete card details by email.",
    ],
  },
  {
    id: "availability",
    title: "13. Reliability, changes and service interruptions",
    paragraphs: [
      "We endeavour to keep the service available, but it may occasionally be interrupted by maintenance, outages, provider failures, security incidents or circumstances outside reasonable control. We cannot promise uninterrupted access or preservation of every third-party link.",
      "Where possible, significant changes to paid functionality will be communicated in an appropriate way. The Terms and Conditions govern service changes, subject always to obligations that cannot lawfully be excluded.",
    ],
  },
  {
    id: "complaints",
    title: "14. Complaints, notices and resolving issues",
    paragraphs: [
      "If you need to raise a complaint about your subscription, a published profile, account access, accessibility or another service matter, contact Snoozer support with a concise explanation and the relevant account or page details.",
      "We may ask for enough information to verify account ownership before discussing private billing or security records. A complaint does not limit your right to use available consumer remedies or to contact a relevant public authority where permitted by law.",
      "Legal notices, formal requests or questions about the operator's identity should reference Snoozer and use the contact details in the section below. Where law requires a postal service address, that address must be separately published before paid sales can be regarded as ready.",
    ],
  },
  {
    id: "updates",
    title: "15. Updates to this information",
    paragraphs: [
      "This notice may be amended to reflect operational changes, applicable laws or new product features. We will keep an accessible current version on this page. Changes do not retrospectively remove rights acquired under an existing contract or override mandatory law.",
      "For the terms governing use of the service, read our Terms and Conditions. For information about personal data and optional analytics, read our Privacy Policy. For plan comparisons and billing documentation, use the Pricing page and Help Centre.",
    ],
  },
] as const;

export default function LegalInformationPage() {
  return <LegalPage title="Legal information">
    <p className="legal-intro">Information about the Snoozer service, its subscriptions and the person legally responsible for operating it. This page is a practical reference, not a substitute for applicable law or your statutory rights.</p>

    <nav aria-label="Legal page contents" className="legal-notice-toc">
      <p className="eyebrow">ON THIS PAGE</p>
      <div className="legal-notice-toc-links">
        {sections.map((section) => <a key={section.id} href={"#" + section.id}>{section.title}</a>)}
        <a href="#trader">16. Business identity and contact</a>
      </div>
    </nav>

    {sections.map((section) => <section key={section.id} id={section.id} className="legal-section stack">
      <h2>{section.title}</h2>
      {section.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
    </section>)}

    <section className="legal-section stack" id="trader" aria-labelledby="trader-heading">
      <h2 id="trader-heading">16. Business identity and contact</h2>
      <p>Snoozer is a trading name of a sole trader based in the United Kingdom. This section identifies the person responsible for operating the service and how to contact the business.</p>
      <dl className="legal-trader-details">
        <div><dt>Trading name</dt><dd>Snoozer</dd></div>
        <div><dt>Legal proprietor</dt><dd>Snoozer</dd></div>
        <div><dt>Business structure</dt><dd>UK sole trader</dd></div>
        <div><dt>Support and business enquiries</dt><dd><a href="mailto:snoozersupport@snoozer.uk">snoozersupport@snoozer.uk</a></dd></div>
      </dl>
      <p>For detailed plan terms, see <Link href="/terms">Terms and Conditions</Link>. For processing of personal data, see <Link href="/privacy">Privacy Policy</Link>. If you intend to make a purchase, first review <Link href="/pricing">Pricing</Link> and the available cancellation information.</p>
    </section>
  </LegalPage>;
}
