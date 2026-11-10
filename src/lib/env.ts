export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function siteUrl() {
  return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
}

export function supabaseConfig() {
  if (!supabaseUrl || !supabaseKey) throw new Error("Supabase is not configured.");
  return { url: supabaseUrl, key: supabaseKey };
}
