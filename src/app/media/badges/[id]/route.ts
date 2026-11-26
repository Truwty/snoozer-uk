import { z } from "zod";
import { sessionClient, storageAdmin } from "@/lib/supabase";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new Response(null, { status: 404 });
  const client = await sessionClient();
  const { data, error } = await client.rpc("profile_badge_artwork", { p_id: id });
  if (error) return new Response(null, { status: 503 });
  const path = z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/i).safeParse(data);
  if (!path.success) return new Response(null, { status: 404 });
  const { data: file, error: storageError } = await storageAdmin().storage.from("custom-badges").download(path.data);
  if (storageError || !file) return new Response(null, { status: 404 });
  return new Response(file, { headers: { "Content-Type":"image/webp", "X-Content-Type-Options":"nosniff", "Cache-Control":"private, no-store" } });
}
