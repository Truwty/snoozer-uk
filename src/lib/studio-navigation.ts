export const studioNavigationGroups = [
  {
    label: "Account",
    items: [
      { label: "Overview", href: "/studio", icon: "⌂", keywords: "dashboard home progress stats" },
      { label: "Analytics", href: "/studio/analytics", icon: "◔", keywords: "views clicks visitors performance charts countries" },
      { label: "Badges", href: "/studio/badges", icon: "✧", keywords: "achievements milestones recognition collection" },
      { label: "Settings", href: "/studio/account", icon: "⚙", keywords: "email password security sessions account settings google mfa language connections gifts delete" },
    ],
  },
  {
    label: "Main",
    items: [
      { label: "Customize", href: "/studio/customize", icon: "✦", keywords: "appearance assets background audio avatar cursor effects glow opacity blur location" },
      { label: "Links", href: "/studio/links", icon: "↗", keywords: "social platforms providers urls buttons icons custom links" },
      { label: "Premium", href: "/studio/plan", icon: "◇", keywords: "subscription usage billing plan gifts" },
      { label: "Image Host", href: "/studio/image-host", icon: "▧", keywords: "image host uploads media gallery storage assets folders" },
      { label: "Templates", href: "/studio/templates", icon: "▤", keywords: "browse favourites recent community profile designs" },
    ],
  },
] as const;

export function filterStudioNavigation(query: string) {
  const needles = query.trim().toLocaleLowerCase("en-GB").split(/\\s+/).filter(Boolean);
  if (needles.length === 0) return studioNavigationGroups;
  return studioNavigationGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      const haystack = (item.label + " " + item.href + " " + item.keywords).toLocaleLowerCase("en-GB");
      return needles.every((needle) => haystack.includes(needle));
    }),
  })).filter((group) => group.items.length > 0);
}
