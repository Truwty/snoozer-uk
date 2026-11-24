export const studioNavigationGroups = [
  { label: "Workspace", items: [
    { label: "Overview", href: "/studio", icon: "⌂", keywords: "dashboard account" },
    { label: "Customize", href: "/studio/customize", icon: "✦", keywords: "appearance colours effects design" },
    { label: "Page Builder", href: "/studio/builder", icon: "▦", keywords: "canvas blocks drag drop layout" },
  ]},
  { label: "Profile", items: [
    { label: "Links", href: "/studio/links", icon: "↗", keywords: "social platforms providers" },
    { label: "Widgets", href: "/studio/widgets", icon: "◈", keywords: "guestbook poll faq testimonials" },
    { label: "Discovery", href: "/studio/discovery", icon: "◎", keywords: "directory category tags public creator listing leaderboard" },
    { label: "Gallery & Assets", href: "/studio/gallery", icon: "▧", keywords: "images media folders uploads" },
    { label: "Templates", href: "/templates", icon: "▤", keywords: "browse favourites recent" },
  ]},
  { label: "Insights", items: [
    { label: "Analytics", href: "/studio/analytics", icon: "⌁", keywords: "views clicks visitors" },
    { label: "Publish History", href: "/studio/history", icon: "◷", keywords: "versions restore publish" },
    { label: "Growth", href: "/studio/growth", icon: "↗", keywords: "referrals audience" },
  ]},
  { label: "Account", items: [
    { label: "Profile Settings", href: "/studio/settings", icon: "⚙", keywords: "aliases domains seo account" },
    { label: "Premium & Usage", href: "/studio/plan", icon: "◇", keywords: "subscription usage billing" },
    { label: "Discord Presence", href: "/studio/discord", icon: "◉", keywords: "discord status connection" },
    { label: "Spotify Embeds", href: "/studio/spotify", icon: "♫", keywords: "spotify music player" },
    { label: "Notifications", href: "/account/notifications", icon: "♧", keywords: "notices updates" },
    { label: "Your Data", href: "/account/data", icon: "⇩", keywords: "privacy export deletion" },
  ]},
] as const;

export function filterStudioNavigation(query: string) {
  const needle = query.trim().toLocaleLowerCase("en-GB");
  if (!needle) return studioNavigationGroups;
  return studioNavigationGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      (item.label + " " + item.href + " " + item.keywords).toLocaleLowerCase("en-GB").includes(needle)),
  })).filter((group) => group.items.length > 0);
}
