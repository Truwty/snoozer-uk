import { z } from "zod";

export const metadataProviders = ["github", "discord"] as const;
export type MetadataProvider = typeof metadataProviders[number];
export const widgetMetadata = z.object({
  version: z.literal(1),
  provider: z.enum(metadataProviders), resource: z.string().min(1).max(150),
  title: z.string().min(1).max(140), description: z.string().max(500),
  stats: z.array(z.object({
    label: z.enum(["Stars", "Forks", "Online", "Members"]), value: z.number().int().nonnegative().safe(),
  }).strict()).max(2),
  fetchedAt: z.iso.datetime(),
}).strict();
export type WidgetMetadata = z.infer<typeof widgetMetadata>;

function publicHttps(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port ? url : null;
  } catch { return null; }
}

export function metadataWidget(value: string): { provider: MetadataProvider; resource: string } | null {
  const url = publicHttps(value);
  if (!url) return null;
  if (url.hostname === "github.com" || url.hostname === "www.github.com") {
    const parts = url.pathname.match(/^\/([A-Za-z0-9][A-Za-z0-9-]{0,38})\/([A-Za-z0-9._-]{1,100})\/?$/);
    if (!parts) return null;
    const repo = parts[2].replace(/\.git$/, "");
    return repo && ![".", ".."].includes(repo) ? { provider: "github", resource: (parts[1] + "/" + repo).toLowerCase() } : null;
  }
  if (["discord.com", "www.discord.com", "discord.gg", "www.discord.gg"].includes(url.hostname)) {
    const invite = url.hostname.replace(/^www\./, "") === "discord.gg"
      ? url.pathname.match(/^\/([A-Za-z0-9_-]{2,64})\/?$/)
      : url.pathname.match(/^\/invite\/([A-Za-z0-9_-]{2,64})\/?$/);
    if (invite) return { provider: "discord", resource: "i:" + invite[1] };
    const guild = url.pathname.match(/^\/channels\/([1-9][0-9]{16,19})(?:\/[1-9][0-9]{16,19})?\/?$/);
    if (guild) return { provider: "discord", resource: "g:" + guild[1] };
  }
  return null;
}

export function twitchChannel(value: string) {
  const url = publicHttps(value);
  if (!url || !["twitch.tv", "www.twitch.tv"].includes(url.hostname)) return null;
  const channel = url.pathname.match(/^\/([A-Za-z0-9_]{3,25})\/?$/)?.[1].toLowerCase();
  return channel && !["directory", "videos", "downloads", "settings", "subscriptions", "search", "jobs", "inventory", "wallet"].includes(channel)
    ? channel : null;
}

export function robloxPlace(value: string) {
  const url = publicHttps(value);
  if (!url || !["roblox.com", "www.roblox.com"].includes(url.hostname)) return null;
  return url.pathname.match(/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?games\/([1-9][0-9]{0,19})(?:\/[^/]*)?\/?$/i)?.[1] ?? null;
}
