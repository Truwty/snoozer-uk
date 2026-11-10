import { createClient } from "@supabase/supabase-js";

const [username, image, caseReference, ...extra] = process.argv.slice(2);
if (extra.length || !/^[a-z][a-z0-9-]{1,28}[a-z0-9]$/.test(username ?? "")
  || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(image ?? "")
  || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,79}$/.test(caseReference ?? "")) {
  throw new Error("Usage: npm run moderation:gallery -- <username> <image-id> <case-reference>");
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Set the target Supabase URL and server credential.");
const client = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) },
});
const { data, error } = await client.rpc("take_down_gallery_image", {
  p_name: username, p_id: image, p_case: caseReference,
});
if (error) throw new Error("The takedown could not be confirmed. Retry with the same case reference.");
if (data === "blocked") console.log("Image blocked across the draft, public page and retained history.");
else if (data === "already_blocked") console.log("This image was already blocked.");
else {
  console.error("No processed gallery image matches that profile and ID.");
  process.exitCode = 1;
}
