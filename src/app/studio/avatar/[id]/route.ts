import { z } from "zod";
import { serveAvatar } from "@/lib/avatar-server";
import { requireAccount } from "@/lib/profiles-server";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new Response(null, { status: 404 });
  const { client } = await requireAccount();
  const { data: scope, error } = await client.rpc("draft_avatar_scope", { p_avatar: id });
  if (error) return new Response(null, { status: 503 });
  if (!scope) return new Response(null, { status: 404 });
  return serveAvatar(scope, id);
}
