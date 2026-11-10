import { supabaseUrl, supabaseKey } from "@/lib/env";
import { canonicalUsername, username } from "@/lib/profile";
import { anonymousClient } from "@/lib/supabase";

export async function GET(_: Request, { params }: { params: Promise<{ username: string }> }) {
  const name = canonicalUsername((await params).username);
  if (!username.safeParse(name).success) return Response.json({ available: false }, { status: 400 });
  if (!supabaseUrl || !supabaseKey) return Response.json({ error: "unavailable" }, { status: 503 });
  const { data, error } = await anonymousClient().rpc("username_available", { p_name: name });
  if (error) return Response.json({ error: "unavailable" }, { status: 503 });
  return Response.json({ username: name, available: data === true }, { headers: { "Cache-Control": "no-store" } });
}
