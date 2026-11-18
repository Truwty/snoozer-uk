import { createHash } from "node:crypto";
import { z } from "zod";
import { productFile, productFileBucket, productFilePath } from "@/lib/product-files";
import { sessionClient, storageAdmin } from "@/lib/supabase";

const versionFile = productFile.extend({ versionId: z.uuid(), sha256: z.string().regex(/^[0-9a-f]{64}$/) });
const unavailable = (status: number) => new Response(null, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return unavailable(404);
  try {
    const client = await sessionClient();
    const user = await client.auth.getUser();
    if (user.error && (user.error.status === 0 || (user.error.status ?? 0) >= 500)) return unavailable(503);
    if (!user.data.user?.email_confirmed_at) return unavailable(404);
    const result = await client.rpc("get_my_product_version_file", { p_version: id });
    if (result.error) return unavailable(503);
    if (!result.data) return unavailable(404);
    const file = versionFile.safeParse(result.data);
    if (!file.success || file.data.versionId !== id || file.data.state !== "ready") return unavailable(503);
    const stored = await storageAdmin().storage.from(productFileBucket).download(productFilePath(file.data));
    if (stored.error || !stored.data || stored.data.size !== file.data.bytes) return unavailable(503);
    const bytes = new Uint8Array(await stored.data.arrayBuffer());
    if (createHash("sha256").update(bytes).digest("hex") !== file.data.sha256) return unavailable(503);
    return new Response(bytes, { headers: { "Content-Type": "application/octet-stream", "Content-Disposition": 'attachment; filename="product-version.pdf"',
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox; default-src 'none'" } });
  } catch {
    return unavailable(503);
  }
}
