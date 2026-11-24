export const socialProviderCategories = [
  "All", "Social", "Video", "Community", "Gaming", "Music", "Developer", "Support", "Other",
] as const;
export type SocialProviderCategory = typeof socialProviderCategories[number];

export const socialProviders = [
  { id: "instagram", label: "Instagram", category: "Social", hosts: ["instagram.com"], baseUrl: "https://instagram.com/" },
  { id: "tiktok", label: "TikTok", category: "Social", hosts: ["tiktok.com"], baseUrl: "https://tiktok.com/@" },
  { id: "x", label: "X", category: "Social", hosts: ["x.com", "twitter.com"], baseUrl: "https://x.com/" },
  { id: "facebook", label: "Facebook", category: "Social", hosts: ["facebook.com", "fb.com"], baseUrl: "https://facebook.com/" },
  { id: "snapchat", label: "Snapchat", category: "Social", hosts: ["snapchat.com"], baseUrl: "https://snapchat.com/add/" },
  { id: "threads", label: "Threads", category: "Social", hosts: ["threads.net"], baseUrl: "https://threads.net/@" },
  { id: "bluesky", label: "Bluesky", category: "Social", hosts: ["bsky.app"], baseUrl: "https://bsky.app/profile/" },
  { id: "pinterest", label: "Pinterest", category: "Social", hosts: ["pinterest.com"], baseUrl: "https://pinterest.com/" },
  { id: "tumblr", label: "Tumblr", category: "Social", hosts: ["tumblr.com"], baseUrl: "https://tumblr.com/" },
  { id: "linkedin", label: "LinkedIn", category: "Social", hosts: ["linkedin.com"], baseUrl: "https://linkedin.com/in/" },
  { id: "youtube", label: "YouTube", category: "Video", hosts: ["youtube.com", "youtu.be"], baseUrl: "https://youtube.com/@" },
  { id: "twitch", label: "Twitch", category: "Video", hosts: ["twitch.tv"], baseUrl: "https://twitch.tv/" },
  { id: "kick", label: "Kick", category: "Video", hosts: ["kick.com"], baseUrl: "https://kick.com/" },
  { id: "discord", label: "Discord", category: "Community", hosts: ["discord.com", "discord.gg"], baseUrl: "https://discord.gg/" },
  { id: "reddit", label: "Reddit", category: "Community", hosts: ["reddit.com"], baseUrl: "https://reddit.com/user/" },
  { id: "telegram", label: "Telegram", category: "Community", hosts: ["t.me", "telegram.me"], baseUrl: "https://t.me/" },
  { id: "whatsapp", label: "WhatsApp", category: "Community", hosts: ["whatsapp.com", "wa.me"], baseUrl: "https://wa.me/" },
  { id: "roblox", label: "Roblox", category: "Gaming", hosts: ["roblox.com"], baseUrl: "https://roblox.com/users/" },
  { id: "steam", label: "Steam", category: "Gaming", hosts: ["steamcommunity.com"], baseUrl: "https://steamcommunity.com/id/" },
  { id: "playstation", label: "PlayStation", category: "Gaming", hosts: ["playstation.com"], baseUrl: "https://playstation.com/" },
  { id: "xbox", label: "Xbox", category: "Gaming", hosts: ["xbox.com"], baseUrl: "https://xbox.com/" },
  { id: "epic", label: "Epic Games", category: "Gaming", hosts: ["epicgames.com"], baseUrl: "https://epicgames.com/" },
  { id: "itch", label: "itch.io", category: "Gaming", hosts: ["itch.io"], baseUrl: "https://itch.io/" },
  { id: "spotify", label: "Spotify", category: "Music", hosts: ["spotify.com", "open.spotify.com"], baseUrl: "https://open.spotify.com/" },
  { id: "soundcloud", label: "SoundCloud", category: "Music", hosts: ["soundcloud.com"], baseUrl: "https://soundcloud.com/" },
  { id: "bandcamp", label: "Bandcamp", category: "Music", hosts: ["bandcamp.com"], baseUrl: "https://bandcamp.com/" },
  { id: "github", label: "GitHub", category: "Developer", hosts: ["github.com"], baseUrl: "https://github.com/" },
  { id: "gitlab", label: "GitLab", category: "Developer", hosts: ["gitlab.com"], baseUrl: "https://gitlab.com/" },
  { id: "behance", label: "Behance", category: "Developer", hosts: ["behance.net"], baseUrl: "https://behance.net/" },
  { id: "dribbble", label: "Dribbble", category: "Developer", hosts: ["dribbble.com"], baseUrl: "https://dribbble.com/" },
  { id: "codepen", label: "CodePen", category: "Developer", hosts: ["codepen.io"], baseUrl: "https://codepen.io/" },
  { id: "kofi", label: "Ko-fi", category: "Support", hosts: ["ko-fi.com"], baseUrl: "https://ko-fi.com/" },
  { id: "patreon", label: "Patreon", category: "Support", hosts: ["patreon.com"], baseUrl: "https://patreon.com/" },
  { id: "buymeacoffee", label: "Buy Me a Coffee", category: "Support", hosts: ["buymeacoffee.com"], baseUrl: "https://buymeacoffee.com/" },
  { id: "website", label: "Website / Custom URL", category: "Other", hosts: [], baseUrl: "https://example.com/" },
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


export function filterSocialProviders(query: string, category: SocialProviderCategory) {
  const needle = query.trim().toLocaleLowerCase("en-GB");
  return socialProviders.filter((provider) =>
    (category === "All" || provider.category === category)
    && (!needle || (provider.label + " " + provider.category + " " + provider.id).toLocaleLowerCase("en-GB").includes(needle)));
}
