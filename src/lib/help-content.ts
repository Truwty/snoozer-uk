export type HelpSection = {
  heading: string;
  paragraphs?: string[];
  steps?: string[];
};
export type HelpArticle = {
  slug: string;
  title: string;
  summary: string;
  category: "Getting started" | "Profiles & Studio" | "Account & security" | "Premium & billing";
  sections: HelpSection[];
};

export const helpArticles: HelpArticle[] = [
  {
    slug: "getting-started", title: "Getting started with Snoozer", category: "Getting started",
    summary: "Create an account, claim your address and publish your first page.",
    sections: [
      { heading: "Your first Snoozer page", steps: [
        "Create an account at Sign up. Email accounts must verify their email address; Discord sign-in is also supported.",
        "Open Studio and claim your unique snoozer.uk/username address.",
        "Add a display name, biography, links and a theme in the editor.",
        "Preview your changes, then choose Publish. Your draft and your public page remain separate.",
        "Share your published page address anywhere you like.",
      ] },
      { heading: "What's free?", paragraphs: ["You can get started without a paid subscription. Check Studio → Plan and usage for your current limits and available plan upgrades."] },
    ],
  },
  {
    slug: "account-switching", title: "Stay signed in and switch accounts", category: "Account & security",
    summary: "Keep multiple accounts on one browser and switch without entering your password each time.",
    sections: [
      { heading: "Add another account", steps: [
        "Select the Dashboard account pill in the top navigation.",
        "Choose Switch Accounts to open Manage Accounts.",
        "Select Add an account. Your original account stays signed in.",
        "Sign in with your other email/password or Discord identity. After authentication it becomes your active account.",
      ] },
      { heading: "Switch, remove or sign out", paragraphs: [
        "Open Dashboard → Switch Accounts and use the menu beside a saved account to switch or sign it out on this browser. Up to four accounts can be stored per browser.",
        "The account menu's Logout option signs out only the active account. Other saved accounts can remain signed in.",
        "Sessions use secure, HttpOnly browser cookies and are refreshed as you use Snoozer. They may still end if you clear cookies, a token is revoked, the browser's cookie lifetime is reached or your provider enforces a session timeout.",
        "Do not save multiple accounts on a shared or public computer.",
      ] },
    ],
  },
  {
    slug: "studio-editor", title: "Customise your profile in Studio", category: "Profiles & Studio",
    summary: "Edit your bio, links, themes and appearance before publishing.",
    sections: [
      { heading: "Edit your draft", steps: [
        "Sign in and open Dashboard in the top navigation.",
        "Choose your profile and edit the display name, biography, theme and links.",
        "Use the Studio preview to see changes before your visitors do.",
        "Publish your draft when you're happy with it. Publication history helps you restore retained versions.",
      ] },
      { heading: "Templates", paragraphs: ["Visit Templates in the top navigation to browse built-in Snoozer layouts and colours. Applying a template helps you get started without changing your published page until you publish again."] },
    ],
  },
  {
    slug: "images-gallery", title: "Use images and the gallery", category: "Profiles & Studio",
    summary: "Upload gallery images and select a background for your page.",
    sections: [
      { heading: "Upload and organise", steps: [
        "Open Studio → Image gallery.",
        "Upload images and organise them into private folders. Supported uploads are processed before use.",
        "Choose a processed gallery image as a background in your draft's appearance settings.",
        "Preview then publish to make the selected imagery visible on your public page.",
      ] },
      { heading: "Privacy and limits", paragraphs: ["Draft gallery media remains private until associated content is published. Your plan's media allowance is visible in Plan and usage."] },
    ],
  },
  {
    slug: "publish-and-history", title: "Publish, preview and restore", category: "Profiles & Studio",
    summary: "Understand drafts, publication history and scheduled publishing.",
    sections: [
      { heading: "Draft versus published", paragraphs: ["Changes in Studio don't appear immediately on your public page. Preview first, then publish. Your publication history contains recent versions that you can restore to a draft."] },
      { heading: "Scheduling", paragraphs: ["For eligible plans, Studio offers scheduling controls. A retained draft snapshot can be set to publish at a chosen time. Always check the schedule status in Studio."] },
    ],
  },
  {
    slug: "custom-domains", title: "Connect a custom domain", category: "Profiles & Studio",
    summary: "Use your own domain with a Snoozer profile.",
    sections: [
      { heading: "Connect an address", steps: [
        "Open Studio and locate the domain controls for your profile.",
        "Check your plan's domain allowance and begin the ownership-verification flow.",
        "Add the requested DNS verification record with your domain provider.",
        "Follow Snoozer's verification steps; the domain must pass provider, DNS and TLS checks before being marked ready.",
      ] },
      { heading: "Changing domains", paragraphs: ["If you disconnect a domain, Snoozer stops routing that address to your profile. DNS changes can take time to propagate, and your registrar remains responsible for the domain itself."] },
    ],
  },
  {
    slug: "profile-analytics", title: "Understand your analytics", category: "Profiles & Studio",
    summary: "Track consented views, clicks and campaign results.",
    sections: [
      { heading: "View reports", steps: [
        "Open Dashboard → Analytics in Studio.",
        "Explore daily profile views, outbound link clicks and eligible campaign data.",
        "Export the reports available to your account when needed.",
      ] },
      { heading: "Privacy", paragraphs: [
        "Snoozer records profile analytics only when visitors allow the optional collection. Counts are not guaranteed to represent unique people; known bots and owner views are filtered. Analytics may therefore be lower than total real-world visits.",
      ] },
    ],
  },
  {
    slug: "premium-billing", title: "Premium plans and billing", category: "Premium & billing",
    summary: "Compare prices, manage renewals and find your payment settings.",
    sections: [
      { heading: "Current approved prices", paragraphs: [
        "Plus costs £3 monthly or £30 yearly. Pro costs £6 monthly or £60 yearly. Studio costs £12 monthly or £100 yearly.",
        "Go to Pricing for comparisons and Studio → Plan and usage to manage your plan. Recurring payments are not enabled until Snoozer's live provider verification and sales disclosures are complete.",
      ] },
      { heading: "When Checkout becomes available", paragraphs: [
        "Subscriptions are handled by Stripe. When available, you will review the price and billing frequency before paying. The Billing Portal supports payment-method updates, invoices and cancellation at the end of a paid period.",
        "The Pricing page reflects whether live Checkout is currently available. All plans renew monthly or yearly until cancelled; you can use the Billing Portal to cancel future renewals. Contact SnoozerSupport@Snoozer.uk for billing issues, refunds, cancellation or accessibility. Statutory consumer rights are not waived.",
      ] },
    ],
  },
  {
    slug: "account-recovery", title: "Sign-in and password recovery", category: "Account & security",
    summary: "Troubleshoot login, reset passwords and protect your account.",
    sections: [
      { heading: "Unable to sign in?", steps: [
        "Check you are using the correct email address and that verification was completed.",
        "Use Forgot your password on the Sign in page to request a recovery link.",
        "Open the recovery link from your email and set a new password.",
        "If your session was revoked, sign in again. If you suspect account compromise, change your password and contact Snoozer support.",
      ] },
      { heading: "Security", paragraphs: ["Passwords and account sessions are managed through Supabase Auth. The browser stores session cookies but does not store account passwords for switching. Avoid using account switching on a shared device."] },
    ],
  },
];
export const helpCategories = ["Getting started", "Profiles & Studio", "Account & security", "Premium & billing"] as const;
export function findHelpArticle(slug: string) {
  return helpArticles.find((article) => article.slug === slug);
}
