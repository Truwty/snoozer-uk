import { serveGalleryImage } from "@/lib/gallery-server";
import { username } from "@/lib/profile";

export async function GET(_: Request, { params }: { params: Promise<{ username: string; id: string }> }) {
  const { username: name, id } = await params;
  if (!username.safeParse(name).success) return new Response(null, { status: 404 });
  return serveGalleryImage(id, { p_name: name });
}
