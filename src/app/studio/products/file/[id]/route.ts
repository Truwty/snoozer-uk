import { z } from "zod";
import { productFile, productFileBucket, productFilePath } from "@/lib/product-files";
import { sessionClient, storageAdmin } from "@/lib/supabase";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new Response(null, { status: 404 });
  const client = await sessionClient();
  const { data, error } = await client.auth.getUser();
  if (error && (error.status === 0 || (error.status ?? 0) >= 500)) return new Response(null, { status: 503 });
  if (!data.user?.email_confirmed_at) return new Response(null, { status: 404 });
  const result = await client.rpc("get_my_product_file", { p_file: id });
  if (result.error) return new Response(null, { status: 503 });
  if (!result.data) return new Response(null, { status: 404 });
  const file = productFile.safeParse(result.data);
  if (!file.success || file.data.id !== id || file.data.state !== "ready") return new Response(null, { status: 503 });
  const stored = await storageAdmin().storage.from(productFileBucket).download(productFilePath(file.data));
  if (stored.error || !stored.data || stored.data.size !== file.data.bytes) return new Response(null, { status: 503 });
  return new Response(stored.data, { headers: { "Content-Type": "application/octet-stream", "Content-Disposition": 'attachment; filename="product.pdf"',
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox; default-src 'none'" } });
}
