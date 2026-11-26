export const studioNavigationGroups = [
  {
    label: "Account",
    items: [
      { label: "Overview", href: "/studio", icon: "⌂", keywords: "dashboard home progress stats" },
      { label: "Analytics", href: "/studio/analytics", icon: "◔", keywords: "views clicks visitors performance charts" },
      { label: "Badges", href: "/studio/badges", icon: "✧", keywords: "achievements milestones recognition collection" },
      { label: "Settings", href: "/studio/account", icon: "⚙", keywords: "email password security sessions account settings google mfa" },
    ],
  },
  {
    label: "Main",
    items: [
      { label: "Customize", href: "/studio/customize", icon: "✦", keywords: "appearance colours effects design fonts backgrounds" },
      { label: "Links", href: "/studio/links", icon: "↗", keywords: "social platforms providers urls buttons" },
      { label: "Premium", href: "/studio/plan", icon: "◇", keywords: "subscription usage billing plan gifts" },
      { label: "Image Host", href: "/studio/image-host", icon: "▧", keywords: "image host uploads media gallery storage assets folders" },
      { label: "Profile Gallery", href: "/studio/gallery", icon: "▧", keywords: "profile gallery published images album folders" },
      { label: "Templates", href: "/studio/templates", icon: "▤", keywords: "browse favourites recent community profile designs" },
    ],
  },
  {
    label: "More Snoozer tools",
    items: [
      { label: "Page Builder", href: "/studio/builder", icon: "▦", keywords: "canvas blocks drag drop layout sections widgets" },
      { label: "Widgets", href: "/studio/widgets", icon: "◈", keywords: "guestbook poll faq testimonials embeds" },
      { label: "Profile Settings", href: "/studio/settings", icon: "⚙", keywords: "aliases domains search visibility privacy custom domain seo" },
      { label: "Discovery", href: "/studio/discovery", icon: "◎", keywords: "directory category tags public creator listing leaderboard" },
      { label: "Publish History", href: "/studio/history", icon: "◷", keywords: "versions restore publish revisions" },
      { label: "Growth", href: "/studio/growth", icon: "↗", keywords: "referrals audience campaigns" },
      { label: "Discord Presence", href: "/studio/discord", icon: "◉", keywords: "discord status connection presence" },
      { label: "Spotify Embeds", href: "/studio/spotify", icon: "♫", keywords: "spotify music player embeds" },
      { label: "Notifications", href: "/account/notifications", icon: "♧", keywords: "notices updates alerts" },
      { label: "Your Data", href: "/account/data", icon: "⇩", keywords: "privacy export deletion gdpr" },
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
