export const studioNavigationGroups = [
  {
    label: "Account",
    items: [
      { label: "Overview", href: "/studio", icon: "⌂", keywords: "dashboard home progress stats" },
      { label: "Analytics", href: "/studio/analytics", icon: "⌁", keywords: "views clicks visitors performance" },
      { label: "Badges", href: "/studio/badges", icon: "✧", keywords: "achievements milestones recognition" },
      { label: "Settings", href: "/studio/account", icon: "⚙", keywords: "email password security sessions account settings" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { label: "Customize", href: "/studio/customize", icon: "✦", keywords: "appearance colours effects design" },
      { label: "Page Builder", href: "/studio/builder", icon: "▦", keywords: "canvas blocks drag drop layout" },
      { label: "Links", href: "/studio/links", icon: "↗", keywords: "social platforms providers" },
      { label: "Widgets", href: "/studio/widgets", icon: "◈", keywords: "guestbook poll faq testimonials" },
    ],
  },
  {
    label: "Your profile",
    items: [
      { label: "Profile Settings", href: "/studio/settings", icon: "⚙", keywords: "profile aliases domains search visibility privacy custom domain" },
      { label: "Premium & Usage", href: "/studio/plan", icon: "◇", keywords: "subscription usage billing plan" },
      { label: "Gallery & Assets", href: "/studio/gallery", icon: "▧", keywords: "image gallery images media folders uploads storage" },
      { label: "Templates", href: "/studio/templates", icon: "▤", keywords: "browse favourites recent community" },
      { label: "Discovery", href: "/studio/discovery", icon: "◎", keywords: "directory category tags public creator listing leaderboard" },
      { label: "Publish History", href: "/studio/history", icon: "◷", keywords: "versions restore publish" },
      { label: "Growth", href: "/studio/growth", icon: "↗", keywords: "referrals audience" },
    ],
  },
  {
    label: "Connections",
    items: [
      { label: "Discord Presence", href: "/studio/discord", icon: "◉", keywords: "discord status connection" },
      { label: "Spotify Embeds", href: "/studio/spotify", icon: "♫", keywords: "spotify music player embeds" },
      { label: "Notifications", href: "/account/notifications", icon: "♧", keywords: "notices updates" },
      { label: "Your Data", href: "/account/data", icon: "⇩", keywords: "privacy export deletion" },
    ],
  },
] as const;

export function filterStudioNavigation(query: string) {
  const needles = query.trim().toLocaleLowerCase("en-GB").split(/\s+/).filter(Boolean);
  if (needles.length === 0) return studioNavigationGroups;
  return studioNavigationGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      const haystack = (item.label + " " + item.href + " " + item.keywords).toLocaleLowerCase("en-GB");
      return needles.every((needle) => haystack.includes(needle));
    }),
  })).filter((group) => group.items.length > 0);
}
