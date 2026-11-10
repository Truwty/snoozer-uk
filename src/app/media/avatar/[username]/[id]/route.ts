import { z } from "zod";
import { serveAvatar } from "@/lib/avatar-server";
import { username } from "@/lib/profile";
import { storageAdmin } from "@/lib/supabase";

export async function GET(_: Request, { params }: { params: Promise<{ username: string; id: string }> }) {
  const { username: name, id } = await params;
  if (!username.safeParse(name).success || !z.uuid().safeParse(id).success) return new Response(null, { status: 404 });
  const { data: scope, error } = await storageAdmin().rpc("published_avatar_scope", { p_name: name, p_avatar: id });
  if (error) return new Response(null, { status: 503 });
  if (!scope) return new Response(null, { status: 404 });
  return serveAvatar(scope, id);
}
