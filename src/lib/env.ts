export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function siteUrl() {
  return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
}

export function supabaseConfig() {
  if (!supabaseUrl || !supabaseKey) throw new Error("Supabase is not configured.");
  return { url: supabaseUrl, key: supabaseKey };
}

export function discordPresenceInviteUrl() {
  const value = process.env.DISCORD_PRESENCE_INVITE_URL?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    const hostAllowed = ["discord.gg", "www.discord.gg", "discord.com", "www.discord.com"].includes(url.hostname.toLowerCase());
    const pathAllowed = /^\/(?:invite\/)?[A-Za-z0-9_-]{2,64}\/?$/.test(url.pathname);
    return url.protocol === "https:" && hostAllowed && pathAllowed && !url.search && !url.hash ? url.href : null;
  } catch {
    return null;
  }
}
