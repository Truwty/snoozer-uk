export const trafficSources = ["direct", "search", "social", "video", "developer", "email", "other"] as const;
export const trafficDevices = ["mobile", "tablet", "desktop", "unknown"] as const;
export type TrafficSource = typeof trafficSources[number];

const knownSources: Record<string, TrafficSource> = {
  google: "search", bing: "search", duckduckgo: "search", search: "search",
  discord: "social", twitter: "social", instagram: "social", facebook: "social", bluesky: "social", social: "social",
  youtube: "video", twitch: "video", video: "video", github: "developer", developer: "developer",
  email: "email", newsletter: "email",
};

export function browserAttribution(location: string, referrer: string): { source: TrafficSource; campaign?: string } {
  let source: TrafficSource = "direct";
  try {
    const page = new URL(location);
    const utmSource = page.searchParams.get("utm_source")?.toLowerCase();
    if (utmSource && Object.hasOwn(knownSources, utmSource)) source = knownSources[utmSource];
    else if (referrer) {
      const from = new URL(referrer);
      const host = from.hostname.replace(/^www\./, "");
      if (from.origin !== page.origin) {
        if (["google.com", "google.co.uk", "bing.com", "duckduckgo.com"].includes(host)) source = "search";
        else if (["discord.com", "discord.gg", "t.co", "twitter.com", "x.com", "facebook.com", "instagram.com", "bsky.app"].includes(host)) source = "social";
        else if (["youtube.com", "youtu.be", "twitch.tv"].includes(host)) source = "video";
        else if (host === "github.com") source = "developer";
        else source = "other";
      }
    }
    const code = page.searchParams.get("utm_campaign");
    // Only generated v4 campaign codes leave the browser, never arbitrary query text.
    const campaign = code && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(code) ? code : undefined;
    return { source, ...(campaign && { campaign }) };
  } catch { return { source: "other" }; }
}

export function analyticsDevice(agent: string): typeof trafficDevices[number] {
  if (!agent) return "unknown";
  if (/iPad|Tablet/i.test(agent) || (/Android/i.test(agent) && !/Mobile/i.test(agent))) return "tablet";
  return /Mobile|iPhone|Android/i.test(agent) ? "mobile" : "desktop";
}

export function attributionForConsentVersion(event: { version?: 2; source?: TrafficSource; campaign?: string }, agent: string) {
  if (event.version !== 2) return { source: "direct", campaign: null, device: "unknown" } as const;
  return { source: event.source ?? "direct", campaign: event.campaign ?? null, device: analyticsDevice(agent) };
}
