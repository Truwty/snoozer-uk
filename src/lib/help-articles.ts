export type HelpArticle = {
  slug: string;
  category: "Getting started" | "Your profile" | "Account and security" | "Premium";
  title: string;
  description: string;
  sections: { heading: string; guidance: string[] }[];
};

export const helpArticles: HelpArticle[] = [
  {
    slug: "getting-started", category: "Getting started", title: "Create your first Snoozer page",
    description: "Register, claim an address and publish your first profile.",
    sections: [
      { heading: "Create and verify your account", guidance: [
        "Choose Get started from the top navigation, then create an account with your email address and password.",
        "Follow the verification link sent to your email. You can also use Continue with Discord on the sign-in page.",
      ] },
      { heading: "Claim your address", guidance: [
        "Open Studio and choose the username you want people to visit at snoozer.uk/yourname.",
        "Make sure your username is available. It becomes the address you can share.",
      ] },
      { heading: "Build and publish", guidance: [
        "Add a display name, biography and links in the Studio editor. Preview your page before publishing.",
        "Publish when you are happy with the result. Your saved draft and live page are separate, so you can keep editing.",
      ] },
    ],
  },
  {
    slug: "customise-profile", category: "Your profile", title: "Customise your profile",
    description: "Choose themes, layouts, colours and a starting template.",
    sections: [
      { heading: "Start with a template", guidance: [
        "Open Templates from the top navigation to browse designs, filter by theme and select one.",
        "Selecting a template opens Studio. Review the changes in the preview before publishing.",
      ] },
      { heading: "Adjust the appearance", guidance: [
        "Use Studio appearance controls to change your theme, layout, spacing and other available options.",
        "Try both desktop and phone previews, and check that your text stays readable.",
      ] },
      { heading: "Publish updates", guidance: [
        "Save your draft, preview the result and publish your changes when ready.",
        "You can use Publish history to inspect earlier versions and restore a previous draft.",
      ] },
    ],
  },
  {
    slug: "add-links-and-projects", category: "Your profile", title: "Add links and projects",
    description: "Organise where visitors can find your work and socials.",
    sections: [
      { heading: "Add a link", guidance: [
        "Go to Studio and open the links section in the editor.",
        "Enter a clear label and an HTTPS address. Preview the link and reorder your items as needed.",
      ] },
      { heading: "Add portfolio content", guidance: [
        "Use the available text and project sections to showcase work, descriptions and important updates.",
        "Keep your labels descriptive so visitors know where each link leads.",
      ] },
      { heading: "Check your plan", guidance: [
        "The Plan and usage page in Studio shows your current link and media allowances.",
        "If you have reached a limit, make room in your draft or review the available Premium plans.",
      ] },
    ],
  },
  {
    slug: "images-and-gallery", category: "Your profile", title: "Use images and your gallery",
    description: "Upload a picture, manage gallery folders and set a background.",
    sections: [
      { heading: "Add media", guidance: [
        "Open Studio → Image gallery to upload images and organise them into folders.",
        "Only publish images you have permission to share. Keep private drafts unpublished.",
      ] },
      { heading: "Set a profile background", guidance: [
        "From the Studio editor, choose a processed image in your gallery as your background.",
        "Preview it on mobile and desktop. Background images follow your profile publication settings.",
      ] },
      { heading: "Manage storage", guidance: [
        "Open Plan and usage to see how much media storage you have used.",
        "Remove images you no longer want. Image and file limits depend on your current plan.",
      ] },
    ],
  },
  {
    slug: "analytics-and-leaderboard", category: "Your profile", title: "Analytics and the leaderboard",
    description: "Understand profile views and opt-in visitor analytics.",
    sections: [
      { heading: "Find your analytics", guidance: [
        "Open Studio → Analytics to view the available figures for your profiles.",
        "Snoozer uses optional visitor consent for the analytics shown there. Counts may be lower than total visits.",
      ] },
      { heading: "Understand the leaderboard", guidance: [
        "Select Leaderboard in the top navigation to explore the Top 50.",
        "All Time Views and Monthly Top Views show different periods. Not every visit is counted, and undiscoverable profiles are excluded.",
      ] },
    ],
  },
  {
    slug: "accounts-and-switching", category: "Account and security", title: "Stay signed in and switch accounts",
    description: "Use multiple Snoozer accounts without entering your password every time.",
    sections: [
      { heading: "Stay signed in", guidance: [
        "After signing in, Snoozer stores your session in a secure, HTTP-only browser cookie.",
        "Your session stays available when you close and reopen the browser, unless you sign out, clear browser data or Supabase ends or revokes your session.",
      ] },
      { heading: "Add and switch accounts", guidance: [
        "Open the account menu in the top right and choose Add another account.",
        "Sign in to your other account by email or Discord. Return to the menu to switch between remembered accounts on this device.",
      ] },
      { heading: "Sign out or remove an account", guidance: [
        "Choose Sign out of this account to sign out of the current one. Other remembered accounts are kept on this device.",
        "Use the remove control beside another account to forget that account on this browser. Never use account switching on a shared computer without signing out afterwards.",
      ] },
    ],
  },
  {
    slug: "premium-and-billing", category: "Premium", title: "Premium plans and billing",
    description: "Find plan prices, check your limits and manage subscriptions.",
    sections: [
      { heading: "See the available plans", guidance: [
        "Open Pricing to compare Free, Plus, Pro and Studio and their monthly and annual prices.",
        "Your Studio → Plan and usage page shows your current entitlement and usage. Premium purchases are only available when Snoozer enables live Checkout.",
      ] },
      { heading: "Billing and cancellations", guidance: [
        "When live Premium is available, use Plan and usage to start the approved Stripe Checkout and manage an active subscription.",
        "Never send card details to a Snoozer profile owner. Snoozer Premium is sold by Snoozer, not by other creators.",
      ] },
    ],
  },
  {
    slug: "troubleshooting", category: "Account and security", title: "Troubleshooting sign-in and publishing",
    description: "Resolve common access, verification and publishing problems.",
    sections: [
      { heading: "Can't sign in?", guidance: [
        "Check that you have verified your email address and entered the correct password.",
        "Use Forgot your password? if needed. If you signed up with Discord, choose Continue with Discord.",
      ] },
      { heading: "Session disappeared?", guidance: [
        "Check that your browser allows first-party cookies for Snoozer and that privacy tools are not deleting them when the browser closes.",
        "A security reset, a revoked session or provider-side time limits may require you to sign in again.",
      ] },
      { heading: "Changes aren't live?", guidance: [
        "Make sure you published the new draft. Saving and publishing are separate actions.",
        "Try opening your public profile in a private browsing window. If the issue continues, contact support.",
      ] },
    ],
  },
];
