"use server";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/actions";
import { checkProductPdf, productFile, productFileBucket, productFilePath } from "@/lib/product-files";
import { requireAccount } from "@/lib/profiles-server";
import { storageAdmin } from "@/lib/supabase";

export async function manageProductVersion(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z.object({ product: z.uuid(), operation: z.enum(["freeze", "discard"]), id: z.uuid(),
    revision: z.coerce.number().int().min(0).max(2147483646) }).safeParse({
    product: form.get("product"), operation: form.get("operation"), id: form.get("id"), revision: form.get("revision"),
  });
  if (!input.success) return { status: "error", message: "Reload the catalogue before managing private versions." };
  const { client, user } = await requireAccount();
  try {
    const value = input.data;
    if (value.operation === "discard") {
      const removed = await client.rpc("discard_my_product_version", { p_product: value.product, p_version: value.id });
      if (removed.error || removed.data !== true) return { status: "error", message: ["23001", "23503"].includes(removed.error?.code ?? "")
        ? "This version is retained by a sandbox offer or order. Withdraw its offer first; versions with orders remain retained."
        : "This version could not be discarded. Reload to check its state." };
      return { status: "success", message: "Private version discarded. Your saved draft and PDF are unchanged." };
    }
    const response = await client.rpc("get_my_product_file", { p_file: value.id });
    const file = productFile.safeParse(response.data);
    if (response.error || !file.success || file.data.productId !== value.product) return { status: "error", message: "Attach a ready private PDF before freezing a version." };
    const admin = storageAdmin();
    const download = await admin.storage.from(productFileBucket).download(productFilePath(file.data));
    if (download.error || !download.data || download.data.size !== file.data.bytes) return { status: "error", message: "The PDF could not be verified. No version was created." };
    const bytes = new Uint8Array(await download.data.arrayBuffer());
    checkProductPdf(bytes);
    const frozen = await admin.rpc("freeze_product_version", { p_owner: user.id, p_product: value.product, p_expected: value.revision,
      p_file: file.data.id, p_sha256: createHash("sha256").update(bytes).digest("hex") });
    if (frozen.error || !z.uuid().safeParse(frozen.data).success) return { status: "error", message: frozen.error?.code === "P1212"
      ? "Five private versions are retained for this product. Discard an unused version first."
      : "The draft or PDF changed. Reload before freezing a version." };
    return { status: "success", message: "Private version frozen with its saved copy, price and PDF fingerprint. It is not published or approved for buyers." };
  } catch {
    return { status: "error", message: "The private version could not be processed. Reload to check its state." };
  } finally {
    revalidatePath("/studio/products");
  }
}
