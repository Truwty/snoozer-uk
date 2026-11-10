import { serveGalleryImage } from "@/lib/gallery-server";
import { sessionClient } from "@/lib/supabase";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data } = await (await sessionClient()).auth.getUser();
  if (!data.user?.email_confirmed_at) return new Response(null, { status: 404 });
  return serveGalleryImage(id, { p_owner: data.user.id });
}
