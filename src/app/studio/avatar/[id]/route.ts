import { z } from "zod";
import { serveAvatar } from "@/lib/avatar-server";
import { requireAccount } from "@/lib/profiles-server";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new Response(null, { status: 404 });
  const { client, user } = await requireAccount();
  const { data, error } = await client.rpc("get_draft");
  if (error) return new Response(null, { status: 503 });
  if (data?.avatar !== id) return new Response(null, { status: 404 });
  return serveAvatar(user.id, id);
}
