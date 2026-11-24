export const socialProviderCategories = [
  "All", "Social", "Video", "Community", "Gaming", "Music", "Developer", "Support", "Other",
] as const;
export type SocialProviderCategory = typeof socialProviderCategories[number];

export const socialProviders = [
  { id: "instagram", label: "Instagram", category: "Social", mark: "IG", hosts: ["instagram.com"], baseUrl: "https://instagram.com/" },
  { id: "tiktok", label: "TikTok", category: "Social", mark: "TT", hosts: ["tiktok.com"], baseUrl: "https://tiktok.com/@" },
  { id: "x", label: "X", category: "Social", mark: "X", hosts: ["x.com", "twitter.com"], baseUrl: "https://x.com/" },
  { id: "facebook", label: "Facebook", category: "Social", mark: "f", hosts: ["facebook.com", "fb.com"], baseUrl: "https://facebook.com/" },
  { id: "snapchat", label: "Snapchat", category: "Social", mark: "SC", hosts: ["snapchat.com"], baseUrl: "https://snapchat.com/add/" },
  { id: "threads", label: "Threads", category: "Social", mark: "@", hosts: ["threads.net"], baseUrl: "https://threads.net/@" },
  { id: "bluesky", label: "Bluesky", category: "Social", mark: "BS", hosts: ["bsky.app"], baseUrl: "https://bsky.app/profile/" },
  { id: "pinterest", label: "Pinterest", category: "Social", mark: "P", hosts: ["pinterest.com"], baseUrl: "https://pinterest.com/" },
  { id: "tumblr", label: "Tumblr", category: "Social", mark: "t", hosts: ["tumblr.com"], baseUrl: "https://tumblr.com/" },
  { id: "linkedin", label: "LinkedIn", category: "Social", mark: "in", hosts: ["linkedin.com"], baseUrl: "https://linkedin.com/in/" },
  { id: "youtube", label: "YouTube", category: "Video", mark: "YT", hosts: ["youtube.com", "youtu.be"], baseUrl: "https://youtube.com/@" },
  { id: "twitch", label: "Twitch", category: "Video", mark: "TW", hosts: ["twitch.tv"], baseUrl: "https://twitch.tv/" },
  { id: "kick", label: "Kick", category: "Video", mark: "K", hosts: ["kick.com"], baseUrl: "https://kick.com/" },
  { id: "discord", label: "Discord", category: "Community", mark: "DC", hosts: ["discord.com", "discord.gg"], baseUrl: "https://discord.gg/" },
  { id: "reddit", label: "Reddit", category: "Community", mark: "rd", hosts: ["reddit.com"], baseUrl: "https://reddit.com/user/" },
  { id: "telegram", label: "Telegram", category: "Community", mark: "TG", hosts: ["t.me", "telegram.me"], baseUrl: "https://t.me/" },
  { id: "whatsapp", label: "WhatsApp", category: "Community", mark: "WA", hosts: ["whatsapp.com", "wa.me"], baseUrl: "https://wa.me/" },
  { id: "roblox", label: "Roblox", category: "Gaming", mark: "RB", hosts: ["roblox.com"], baseUrl: "https://roblox.com/users/" },
  { id: "steam", label: "Steam", category: "Gaming", mark: "ST", hosts: ["steamcommunity.com"], baseUrl: "https://steamcommunity.com/id/" },
  { id: "playstation", label: "PlayStation", category: "Gaming", mark: "PS", hosts: ["playstation.com"], baseUrl: "https://playstation.com/" },
  { id: "xbox", label: "Xbox", category: "Gaming", mark: "XB", hosts: ["xbox.com"], baseUrl: "https://xbox.com/" },
  { id: "epic", label: "Epic Games", category: "Gaming", mark: "EG", hosts: ["epicgames.com"], baseUrl: "https://epicgames.com/" },
  { id: "itch", label: "itch.io", category: "Gaming", mark: "it", hosts: ["itch.io"], baseUrl: "https://itch.io/" },
  { id: "spotify", label: "Spotify", category: "Music", mark: "SP", hosts: ["spotify.com", "open.spotify.com"], baseUrl: "https://open.spotify.com/" },
  { id: "soundcloud", label: "SoundCloud", category: "Music", mark: "SC", hosts: ["soundcloud.com"], baseUrl: "https://soundcloud.com/" },
  { id: "bandcamp", label: "Bandcamp", category: "Music", mark: "BC", hosts: ["bandcamp.com"], baseUrl: "https://bandcamp.com/" },
  { id: "github", label: "GitHub", category: "Developer", mark: "GH", hosts: ["github.com"], baseUrl: "https://github.com/" },
  { id: "gitlab", label: "GitLab", category: "Developer", mark: "GL", hosts: ["gitlab.com"], baseUrl: "https://gitlab.com/" },
  { id: "behance", label: "Behance", category: "Developer", mark: "Be", hosts: ["behance.net"], baseUrl: "https://behance.net/" },
  { id: "dribbble", label: "Dribbble", category: "Developer", mark: "Dr", hosts: ["dribbble.com"], baseUrl: "https://dribbble.com/" },
  { id: "codepen", label: "CodePen", category: "Developer", mark: "CP", hosts: ["codepen.io"], baseUrl: "https://codepen.io/" },
  { id: "kofi", label: "Ko-fi", category: "Support", mark: "K", hosts: ["ko-fi.com"], baseUrl: "https://ko-fi.com/" },
  { id: "patreon", label: "Patreon", category: "Support", mark: "Pa", hosts: ["patreon.com"], baseUrl: "https://patreon.com/" },
  { id: "buymeacoffee", label: "Buy Me a Coffee", category: "Support", mark: "☕", hosts: ["buymeacoffee.com"], baseUrl: "https://buymeacoffee.com/" },
  { id: "website", label: "Website / Custom URL", category: "Other", mark: "↗", hosts: [], baseUrl: "https://example.com/" },
] as const;

export type SocialProvider = typeof socialProviders[number];
export type SocialProviderId = SocialProvider["id"];

export function socialProviderForUrl(value: string): SocialProvider | null {
  try {
    const host = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
    return socialProviders.find((provider) => provider.hosts.some((domain) =>
      host === domain || host.endsWith("." + domain))) ?? null;
  } catch {
    return null;
  }
}

export function socialMarkForUrl(value: string): string | null {
  return socialProviderForUrl(value)?.mark ?? null;
}

export function filterSocialProviders(query: string, category: SocialProviderCategory) {
  const needle = query.trim().toLocaleLowerCase("en-GB");
  return socialProviders.filter((provider) =>
    (category === "All" || provider.category === category)
    && (!needle || (provider.label + " " + provider.category + " " + provider.id).toLocaleLowerCase("en-GB").includes(needle)));
}
