export type HelpUpdate = {
  date: string;
  title: string;
  summary: string;
  href: string;
  label: string;
};

export const helpUpdates: HelpUpdate[] = [
  {
    date: "24 November 2026",
    label: "DISCOVER",
    title: "Creator discovery and curated collections",
    summary: "Creators can opt into Discover, choose public categories and interests, and decide whether related-creator recommendations can include their profile.",
    href: "/help/creator-discovery",
  },
  {
    date: "23 November 2026",
    label: "PROFILE WIDGETS",
    title: "More ways to make your profile interactive",
    summary: "FAQ, Testimonials, Poll and moderated Guestbook widgets give visitors more ways to engage with a published profile.",
    href: "/help/interactive-widgets",
  },
  {
    date: "21 November 2026",
    label: "ACCOUNT EXPERIENCE",
    title: "Persistent sessions and account switching",
    summary: "Manage more than one signed-in account in the same browser and switch between them from the Snoozer account menu.",
    href: "/help/account-switching",
  },
  {
    date: "21 November 2026",
    label: "HELP CENTRE",
    title: "A new place to find answers",
    summary: "The Snoozer Help Centre brings account, profile, Studio and billing guidance together in one searchable place.",
    href: "/help/getting-started",
  },
];
