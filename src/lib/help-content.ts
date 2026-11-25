export type HelpCategorySlug =
  | "getting-started"
  | "profiles-studio"
  | "account-security"
  | "premium-billing"
  | "privacy-safety"
  | "troubleshooting";

export type HelpSection = {
  heading: string;
  paragraphs?: string[];
  steps?: string[];
  bullets?: string[];
};

export type HelpArticle = {
  slug: string;
  title: string;
  summary: string;
  category: HelpCategorySlug;
  keywords: string[];
  sections: HelpSection[];
  related?: string[];
};

export type HelpCategory = {
  slug: HelpCategorySlug;
  title: string;
  description: string;
  symbol: string;
};

export const helpCategories: HelpCategory[] = [
  {
    slug: "getting-started",
    title: "Getting started",
    description: "Everything you need to set up your account and publish your first page.",
    symbol: "01",
  },
  {
    slug: "profiles-studio",
    title: "Profiles & Studio",
    description: "Build your page, connect your links and make your profile your own.",
    symbol: "02",
  },
  {
    slug: "account-security",
    title: "Account & security",
    description: "Sign-in, account sessions, recovery and keeping your account safe.",
    symbol: "03",
  },
  {
    slug: "premium-billing",
    title: "Premium & billing",
    description: "Understand plans, payments, renewals and subscription management.",
    symbol: "04",
  },
  {
    slug: "privacy-safety",
    title: "Privacy & safety",
    description: "Your data, moderation, reporting and account privacy controls.",
    symbol: "05",
  },
  {
    slug: "troubleshooting",
    title: "Troubleshooting",
    description: "Practical fixes for common sign-in, publishing and profile issues.",
    symbol: "06",
  },
];

export const helpArticles: HelpArticle[] = [
  {
    slug: "getting-started",
    title: "Getting started with Snoozer",
    category: "getting-started",
    summary: "Create your account, claim a username and get your first page online.",
    keywords: ["register", "sign up", "new account", "username", "first page", "publish"],
    sections: [
      {
        heading: "Create your account",
        steps: [
          "Open Sign up from the Snoozer website.",
          "Register with your email address or continue with Discord.",
          "Complete any email verification step shown during registration.",
          "Sign in and open Studio from the main navigation.",
        ],
      },
      {
        heading: "Build your first page",
        steps: [
          "Choose an available username for your public Snoozer address.",
          "Add a display name, short biography and the links you want people to find.",
          "Choose a theme and adjust the look of your profile.",
          "Use Preview to check the page on desktop and mobile.",
          "Publish when you are happy with the result.",
        ],
      },
      {
        heading: "Drafts and published pages",
        paragraphs: [
          "Your Studio changes are a draft until you publish them. Visitors see the published version, not unfinished edits. You can return to Studio whenever you want to make another change.",
          "Your public page lives at snoozer.uk/your-username unless you have connected an eligible custom domain.",
        ],
      },
      {
        heading: "Where to go next",
        bullets: [
          "Customise your profile in Studio",
          "Add social and website links",
          "Publish, preview and restore a version",
          "Explore Premium plans",
        ],
      },
    ],
    related: ["studio-editor", "social-links", "publish-and-history"],
  },
  {
    slug: "studio-editor",
    title: "Customise your profile in Studio",
    category: "profiles-studio",
    summary: "Find your way around the editor and shape the appearance of your public page.",
    keywords: ["editor", "dashboard", "customise", "customize", "bio", "theme", "design"],
    sections: [
      {
        heading: "Open the editor",
        steps: [
          "Sign in to Snoozer.",
          "Choose Studio from the main navigation.",
          "Open the profile you want to edit.",
          "Use the editor sections to update your identity, links, appearance and optional features.",
        ],
      },
      {
        heading: "Make changes safely",
        paragraphs: [
          "The preview shows how your draft is expected to look. It does not replace the published page until you publish.",
          "Keep your display name, biography and link labels readable at phone widths. Very long text and oversized media can make a profile harder to use.",
        ],
      },
      {
        heading: "Templates",
        paragraphs: [
          "Open Templates to browse the available starting layouts. A template can help you set up a consistent look more quickly. Review the result in Studio before publishing it.",
          "Applying a template does not give you ownership of third-party assets or permission to use images, logos or text you do not have rights to.",
        ],
      },
    ],
    related: ["images-gallery", "profile-effects", "publish-and-history"],
  },
  {
    slug: "social-links",
    title: "Add and organise your social links",
    category: "profiles-studio",
    summary: "Show visitors where to find you across social platforms and the wider web.",
    keywords: ["social", "instagram", "tiktok", "youtube", "discord", "links", "website", "icons"],
    sections: [
      {
        heading: "Add a link",
        steps: [
          "Open Studio and select the profile you want to edit.",
          "Open the Links or Social Links section.",
          "Choose the appropriate platform or a custom website link.",
          "Enter the full destination address and check that it points to the correct account.",
          "Save your draft, preview the link and publish your changes.",
        ],
      },
      {
        heading: "Keep your links clear",
        bullets: [
          "Use the correct platform type so Snoozer can display the matching brand icon.",
          "Check for spelling mistakes and remove tracking or redirect links you do not recognise.",
          "Use labels that tell visitors what they will open.",
          "Remove links that are no longer active or that you no longer control.",
        ],
      },
      {
        heading: "A link is not an account connection",
        paragraphs: [
          "Adding a social URL simply displays a link on your profile. It does not grant Snoozer access to that platform or connect the account for sign-in.",
          "Features that need an account connection, such as Discord presence, have their own connection and privacy controls.",
        ],
      },
    ],
    related: ["discord-presence", "studio-editor"],
  },
  {
    slug: "discord-presence",
    title: "Connect and display Discord presence",
    category: "profiles-studio",
    summary: "Understand the optional Discord connection and the status shown on your profile.",
    keywords: ["discord", "presence", "online", "offline", "status", "bot", "activity"],
    sections: [
      {
        heading: "Before you connect",
        paragraphs: [
          "Discord presence is an optional profile feature. It is separate from adding a Discord invite or username as an ordinary social link.",
          "Only connect the Discord account and profile you intend to show publicly. Review the information displayed in Studio before enabling the feature.",
        ],
      },
      {
        heading: "Enable the feature",
        steps: [
          "Sign in and open Studio.",
          "Open the Discord or Presence settings for your profile.",
          "Follow the connection steps shown by Snoozer.",
          "Choose whether to display the presence feature and review the public preview.",
          "Publish your profile when the preview is correct.",
        ],
      },
      {
        heading: "What visitors see",
        paragraphs: [
          "When enabled and available, the profile can display a simple Discord presence indicator. The status may change as Discord presence updates arrive; it is not a guarantee that a person is actively viewing Snoozer.",
          "Snoozer displays a limited public presence summary. It does not publish private messages, authentication tokens or private account details on your profile.",
        ],
      },
      {
        heading: "Turn it off or troubleshoot",
        paragraphs: [
          "You can disable the feature in Studio. If the status is missing or looks out of date, check that the intended Discord account is connected, the feature is enabled and the profile has been published.",
          "A temporary Discord or Snoozer service interruption can delay updates. Try again later before disconnecting and reconnecting the account.",
        ],
      },
    ],
    related: ["social-links", "privacy-and-safety", "troubleshooting"],
  },
  {
    slug: "profile-effects",
    title: "Profile animations and visual effects",
    category: "profiles-studio",
    summary: "Add motion and effects while keeping your page readable and comfortable to use.",
    keywords: ["animation", "effects", "background", "glow", "cursor", "motion", "particles"],
    sections: [
      {
        heading: "Choose an effect",
        steps: [
          "Open Studio and select your profile.",
          "Open the appearance or effects controls.",
          "Choose from the options available to your plan.",
          "Preview the result on desktop and mobile before publishing.",
        ],
      },
      {
        heading: "Use effects thoughtfully",
        paragraphs: [
          "Effects should support your profile rather than compete with its content. Keep text contrast strong and avoid busy backgrounds behind important information.",
          "Some effects may be reduced or disabled on touch devices, slower devices or when the visitor has requested reduced motion in their operating system.",
        ],
      },
      {
        heading: "Visitor controls",
        paragraphs: [
          "Where the profile provides an effects control, visitors can use it to reduce or disable decorative effects. Snoozer also respects the browser's reduced-motion preference for supported animations.",
        ],
      },
    ],
    related: ["studio-editor", "images-gallery"],
  },
  {
    slug: "images-gallery",
    title: "Upload images and use your gallery",
    category: "profiles-studio",
    summary: "Add profile imagery, organise uploads and choose media for your page.",
    keywords: ["image", "gallery", "upload", "avatar", "background", "folder", "media"],
    sections: [
      {
        heading: "Upload an image",
        steps: [
          "Open Studio and go to Gallery.",
          "Choose the upload option and select an image from your device.",
          "Wait for processing to finish and check that the image appears in your gallery.",
          "Choose the image in the relevant profile appearance or media setting.",
          "Preview and publish the change when you are ready.",
        ],
      },
      {
        heading: "Organise your files",
        paragraphs: [
          "Use gallery folders to keep related media together. Check the file's preview before selecting it for a public profile.",
          "Your plan's storage or upload limits are shown in the relevant Studio area. Remove files you no longer need to stay within your allowance.",
        ],
      },
      {
        heading: "Images and privacy",
        paragraphs: [
          "An image stored in your gallery is not automatically displayed on your public profile. It becomes visible when you use it in published profile content or another public feature.",
          "Only upload content you have the right to use. Do not upload private images of another person without their permission.",
        ],
      },
    ],
    related: ["studio-editor", "profile-effects", "troubleshooting"],
  },
  {
    slug: "publish-and-history",
    title: "Preview, publish and restore your profile",
    category: "profiles-studio",
    summary: "Learn how drafts, published pages and your saved publication history work.",
    keywords: ["draft", "publish", "preview", "history", "restore", "version", "schedule"],
    sections: [
      {
        heading: "Preview before publishing",
        paragraphs: [
          "Studio edits are saved as a draft. Use Preview to check the result before visitors see it. Pay particular attention to mobile spacing, text, image crops and link destinations.",
        ],
      },
      {
        heading: "Publish your changes",
        steps: [
          "Open the profile in Studio.",
          "Review the current draft and resolve any validation messages.",
          "Choose Publish and follow the confirmation shown.",
          "Open your public profile in a separate tab to verify the published result.",
        ],
      },
      {
        heading: "Restore an earlier version",
        paragraphs: [
          "Publication history keeps the versions available to your account. Open Studio → History, choose a retained version and restore it to a draft before publishing.",
          "Restoring a version changes the draft; it does not silently replace the page visitors currently see.",
        ],
      },
    ],
    related: ["studio-editor", "custom-domains"],
  },
  {
    slug: "custom-domains",
    title: "Connect a custom domain",
    category: "profiles-studio",
    summary: "Use a domain you own for your Snoozer profile.",
    keywords: ["domain", "dns", "custom url", "hostname", "tls", "ssl", "verification"],
    sections: [
      {
        heading: "Before you begin",
        paragraphs: [
          "You must control the domain or have permission from its owner to change DNS records. Check the custom-domain availability and allowance shown for your Snoozer plan.",
        ],
      },
      {
        heading: "Connect and verify",
        steps: [
          "Open Studio and find the Custom Domain settings.",
          "Enter the domain you want to connect and start the verification flow.",
          "Add the exact DNS records shown by Snoozer at your domain provider.",
          "Return to Studio and run the verification step.",
          "Wait for the domain to pass the required DNS, provider and TLS checks before treating it as ready.",
        ],
      },
      {
        heading: "DNS changes and troubleshooting",
        paragraphs: [
          "DNS updates can take time to appear across the internet. Keep the records exactly as shown and avoid adding extra conflicting records.",
          "If verification fails, compare the record name, value and record type with the instructions in Studio. Your registrar controls your domain registration and renewal; Snoozer only handles the profile routing configured for the domain.",
        ],
      },
    ],
    related: ["publish-and-history", "troubleshooting"],
  },
  {
    slug: "interactive-widgets",
    title: "Set up profile widgets",
    category: "profiles-studio",
    summary: "Configure your FAQ, Guestbook, Poll and Testimonials widgets.",
    keywords: ["widget", "guestbook", "poll", "faq", "testimonials", "comments", "vote"],
    sections: [
      {
        heading: "Add a widget",
        steps: [
          "Open Studio and choose the Widgets section.",
          "Enable the widget you want to use.",
          "Add its content and choose its display order.",
          "Save your draft, preview the result and publish the page.",
        ],
      },
      {
        heading: "Guestbook",
        paragraphs: [
          "Guestbook submissions are held for review before appearing on your public page. Open the moderation controls in Studio to approve, reject or delete submissions.",
          "Visitors can report an approved message. Keep submissions closed or adjust the available controls if you do not want to receive new messages.",
        ],
      },
      {
        heading: "Polls",
        paragraphs: [
          "A poll supports two to six options. Changing the question or options starts a new poll so earlier votes are not mixed into the new result. You can close a poll manually or choose a closing time.",
          "Snoozer uses a browser-scoped voting token as an abuse-prevention measure. It is not proof of a unique person; a different browser or cleared browser storage may allow another vote. Polls are for informal engagement, not elections or high-stakes decisions.",
        ],
      },
      {
        heading: "FAQ and Testimonials",
        paragraphs: [
          "FAQ answers and creator-curated testimonials are public when the profile is published. Only publish feedback you have permission to display.",
          "Widget text is plain text. Do not expect HTML or scripts to run inside widget content.",
        ],
      },
    ],
    related: ["publish-and-history", "privacy-and-safety"],
  },
  {
    slug: "creator-discovery",
    title: "Appear in Discover and the leaderboard",
    category: "profiles-studio",
    summary: "Control whether your public profile can appear in creator discovery and rankings.",
    keywords: ["discover", "directory", "collections", "categories", "leaderboard", "recommendations", "views"],
    sections: [
      {
        heading: "Opt in to Discover",
        steps: [
          "Open Studio and select the profile you want to manage.",
          "Open the Discovery settings.",
          "Enable the option allowing your profile to appear in Discover.",
          "Choose the category and interests that best describe your page.",
          "Save your preferences and check the public preview.",
        ],
      },
      {
        heading: "What appears publicly",
        paragraphs: [
          "Discover may display public profile information such as your username, display name, avatar, biography, category and selected interests. Do not place private information in public profile fields.",
          "Discover is separate from search-engine indexing. Turning off directory discovery does not automatically make your public profile URL private.",
        ],
      },
      {
        heading: "Related creators and collections",
        paragraphs: [
          "If you enable related-creator recommendations, your profile may appear alongside other creators using public category and interest information.",
          "Snoozer may feature public profiles in editorial collections. A collection is not a paid placement or an endorsement of a creator's identity, products or services.",
        ],
      },
      {
        heading: "The Views Leaderboard",
        paragraphs: [
          "Leaderboard participation is controlled separately from Discover. Check the relevant Studio privacy or discovery settings if you do not want your profile included in public ranking surfaces.",
        ],
      },
    ],
    related: ["profile-analytics", "privacy-and-safety"],
  },
  {
    slug: "profile-analytics",
    title: "Understand profile analytics",
    category: "profiles-studio",
    summary: "See how visitors view and interact with your Snoozer page.",
    keywords: ["analytics", "views", "clicks", "traffic", "export", "visitors", "consent"],
    sections: [
      {
        heading: "Open your analytics",
        steps: [
          "Sign in and open Studio.",
          "Choose Analytics from the Studio navigation.",
          "Select the date range or report available to your account.",
          "Use the export option when you need a copy of an available report.",
        ],
      },
      {
        heading: "How to read the numbers",
        paragraphs: [
          "Views and link clicks describe recorded activity, not a guaranteed count of unique people. Automated traffic and owner activity may be filtered.",
          "Some optional analytics collection depends on visitor privacy choices. As a result, analytics may not match every visit or click that happened.",
        ],
      },
      {
        heading: "Privacy",
        paragraphs: [
          "Snoozer's optional analytics are separate from essential site operations. Do not use profile analytics to identify or track an individual visitor.",
        ],
      },
    ],
    related: ["creator-discovery", "privacy-and-safety"],
  },
  {
    slug: "account-switching",
    title: "Stay signed in and switch accounts",
    category: "account-security",
    summary: "Keep multiple Snoozer accounts signed in on one browser and switch between them.",
    keywords: ["switch", "accounts", "account switching", "session", "logout", "sign out", "browser"],
    sections: [
      {
        heading: "Add another account",
        steps: [
          "Open the account menu in the top navigation.",
          "Choose Switch Accounts or Manage Accounts.",
          "Select Add an account.",
          "Sign in with the other email address or Discord identity.",
          "After authentication, choose the account you want to use.",
        ],
      },
      {
        heading: "Switch or remove an account",
        paragraphs: [
          "Use the account menu to switch between saved accounts or sign one out on this browser. The account menu's Logout option signs out the active account; other saved accounts can remain available.",
          "Snoozer supports multiple saved account sessions in the same browser. The available slots and account controls are shown in Manage Accounts.",
        ],
      },
      {
        heading: "Keep your accounts safe",
        paragraphs: [
          "Do not save accounts on a shared or public computer. Sign out of any account you no longer want stored on the device.",
          "Clearing browser cookies, revoking a session or an authentication-provider timeout can require you to sign in again.",
        ],
      },
    ],
    related: ["account-recovery", "privacy-and-safety"],
  },
  {
    slug: "account-recovery",
    title: "Sign in and recover your account",
    category: "account-security",
    summary: "Fix common login problems and reset a forgotten password.",
    keywords: ["login", "sign in", "forgot password", "reset", "email verification", "discord"],
    sections: [
      {
        heading: "If you cannot sign in",
        bullets: [
          "Check that the email address is spelled correctly.",
          "If you registered by email, check your inbox and spam folder for the verification message.",
          "If you normally use Discord, try the same sign-in method you used when creating the account.",
          "Make sure your browser allows the site to use the session cookies needed to keep you signed in.",
        ],
      },
      {
        heading: "Reset your password",
        steps: [
          "Open Sign in and select Forgot password.",
          "Enter the email address associated with your account.",
          "Open the recovery email and follow its link.",
          "Choose a new password and sign in again.",
        ],
      },
      {
        heading: "If you suspect your account was compromised",
        paragraphs: [
          "Reset your password as soon as possible and review any connected account or session settings available to you.",
          "Contact Snoozer support from the email address associated with the account. Never send your password, recovery code or authentication token to support.",
        ],
      },
    ],
    related: ["account-switching", "privacy-and-safety", "troubleshooting"],
  },
  {
    slug: "premium-billing",
    title: "Premium plans, payments and cancellations",
    category: "premium-billing",
    summary: "Understand plan prices, recurring billing, invoices and subscription changes.",
    keywords: ["premium", "plus", "pro", "studio", "price", "payment", "stripe", "refund", "cancel", "renewal"],
    sections: [
      {
        heading: "Compare plans and prices",
        paragraphs: [
          "The Pricing page shows Snoozer's current plans, features and GBP prices. Check the price and billing frequency displayed at checkout before confirming a purchase, as plan availability and pricing can change.",
          "Plus, Pro and Studio are optional subscriptions sold by Snoozer. They are not marketplace products sold by other users.",
        ],
      },
      {
        heading: "Manage a subscription",
        steps: [
          "Sign in and open Studio → Plan.",
          "Review your current plan and the billing controls available to your account.",
          "When the Billing Portal is available, use it to update your payment method, view invoices or cancel future renewals.",
          "Check the confirmation shown by the billing provider after making a change.",
        ],
      },
      {
        heading: "Renewals and cancellations",
        paragraphs: [
          "A subscription renews at the monthly or annual interval shown when you subscribe until you cancel future renewals. Cancellation normally leaves access available until the end of the paid period, unless access ends sooner because a payment is refunded, disputed or reversed.",
          "Cancelling future renewals does not, by itself, request a refund for a payment already taken.",
        ],
      },
      {
        heading: "Refunds and billing problems",
        paragraphs: [
          "Snoozer generally does not offer voluntary refunds for subscription charges. This does not remove any refund, remedy or cancellation right you have under applicable consumer law, including any applicable cooling-off rights or rights for services that are faulty or not provided as described.",
          "For billing errors, cancellation problems or a refund request, email snoozersupport@snoozer.uk from the address associated with your account. Include the plan and approximate transaction date, but never send full card details.",
        ],
      },
    ],
    related: ["account-recovery", "troubleshooting"],
  },
  {
    slug: "privacy-and-safety",
    title: "Privacy, moderation and reporting",
    category: "privacy-safety",
    summary: "Understand public profile information, visitor reports and how to raise a privacy concern.",
    keywords: ["privacy", "data", "gdpr", "report", "moderation", "blocked", "appeal", "safety"],
    sections: [
      {
        heading: "What is public on your profile?",
        paragraphs: [
          "Information you add to a published profile is intended to be visible to visitors. This can include your username, display name, biography, links, selected media and enabled widgets.",
          "Keep private contact details, passwords, access tokens and other sensitive information out of public profile fields.",
        ],
      },
      {
        heading: "Reports and moderation",
        paragraphs: [
          "Visitors can report eligible public profile content using the reporting controls shown on Snoozer. Reports are reviewed through Snoozer's moderation process; submitting a report does not guarantee a particular outcome.",
          "Do not use reporting tools to harass other users or submit knowingly false information.",
        ],
      },
      {
        heading: "Privacy requests",
        paragraphs: [
          "For questions about personal data or a privacy request, email snoozersupport@snoozer.uk. Use the account associated with the request where possible so Snoozer can verify that you are entitled to discuss the data.",
          "Snoozer may need to verify your identity before acting on an account or data request. Never include passwords, one-time codes or recovery tokens in your message.",
        ],
      },
      {
        heading: "Read the full policies",
        bullets: [
          "Privacy Policy",
          "Terms of Service",
          "Legal information and business contact details",
        ],
      },
    ],
    related: ["account-recovery", "discord-presence"],
  },
  {
    slug: "troubleshooting",
    title: "Troubleshoot common Snoozer issues",
    category: "troubleshooting",
    summary: "Quick checks for login, missing profile changes, image uploads and domain problems.",
    keywords: ["troubleshooting", "not working", "error", "missing", "page not found", "upload", "domain", "login"],
    sections: [
      {
        heading: "My changes are not showing",
        bullets: [
          "Check that you published the latest draft rather than only saving it.",
          "Refresh the public profile and check the address is correct.",
          "If you use a custom domain, verify its status in Studio and allow time for DNS changes to propagate.",
        ],
      },
      {
        heading: "My image will not upload",
        bullets: [
          "Check that the file type and size are accepted by the upload control.",
          "Make sure you have not reached the storage or upload allowance shown for your plan.",
          "Try a supported image export and upload again.",
          "If the upload remains stuck, note the time and the error shown in Studio before contacting support.",
        ],
      },
      {
        heading: "My profile or link is unavailable",
        paragraphs: [
          "Check the username or destination URL for spelling mistakes. If you recently changed a domain or username, use the current address displayed in Studio.",
          "A profile can be unavailable while unpublished, restricted or being updated. If you believe this is an error, contact support with the public URL.",
        ],
      },
      {
        heading: "Still stuck?",
        paragraphs: [
          "Email snoozersupport@snoozer.uk and include the page you were using, what you expected to happen, what happened instead and the approximate time. Do not send passwords or authentication codes.",
        ],
      },
    ],
    related: ["account-recovery", "images-gallery", "custom-domains"],
  },
];

export const popularHelpArticleSlugs = [
  "getting-started",
  "studio-editor",
  "social-links",
  "premium-billing",
  "discord-presence",
  "account-recovery",
];

export function findHelpArticle(slug: string) {
  return helpArticles.find((article) => article.slug === slug);
}

export function findHelpCategory(slug: string) {
  return helpCategories.find((category) => category.slug === slug);
}

export function articlesInCategory(slug: string) {
  const category = findHelpCategory(slug);
  return category ? helpArticles.filter((article) => article.category === category.slug) : [];
}

export function getRelatedHelpArticles(article: HelpArticle, limit = 3) {
  const related = (article.related ?? [])
    .map((slug) => findHelpArticle(slug))
    .filter((item): item is HelpArticle => Boolean(item));
  if (related.length >= limit) return related.slice(0, limit);
  const sameCategory = helpArticles.filter((item) =>
    item.category === article.category && item.slug !== article.slug && !related.some((entry) => entry.slug === item.slug));
  return [...related, ...sameCategory].slice(0, limit);
}

export function helpSectionId(heading: string) {
  return heading.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function helpArticleReadingTime(article: HelpArticle) {
  const words = [article.summary, ...article.sections.flatMap((section) => [
    section.heading,
    ...(section.paragraphs ?? []),
    ...(section.steps ?? []),
    ...(section.bullets ?? []),
  ])].join(" ").split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 210));
}
