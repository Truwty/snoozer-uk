"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/actions";
import { checkProductPdf, productFile, productFileBucket, productFileMaxBytes, productFilePath } from "@/lib/product-files";
import { requireAccount } from "@/lib/profiles-server";
import { storageAdmin } from "@/lib/supabase";

export async function manageProductFile(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z.object({ profile: z.uuid(), product: z.uuid(), operation: z.enum(["upload", "finish", "remove"]) }).safeParse({ profile: form.get("profile"), product: form.get("product"), operation: form.get("operation") });
  if (!input.success) return { status: "error", message: "Reload the product catalogue before trying again." };
  const { client, user } = await requireAccount();
  const inventory = await client.rpc("list_my_product_drafts", { p_profile: input.data.profile });
  const products = z.object({ items: z.array(z.object({ id: z.uuid() })) }).safeParse(inventory.data);
  if (inventory.error || !products.success || !products.data.items.some((item) => item.id === input.data.product)) return { status: "error", message: "Product unavailable. Reload the catalogue." };
  const admin = storageAdmin();
  const bucket = admin.storage.from(productFileBucket);
  try {
    let file;
    if (input.data.operation === "upload") {
      const upload = form.get("file");
      if (!(upload instanceof File) || upload.type !== "application/pdf" || upload.size > productFileMaxBytes || !upload.size) return { status: "error", message: "Choose a PDF up to 4 MB." };
      const bytes = new Uint8Array(await upload.arrayBuffer());
      checkProductPdf(bytes);
      const reserved = await admin.rpc("prepare_product_file", { p_owner: user.id, p_product: input.data.product, p_bytes: bytes.length });
      file = productFile.safeParse(reserved.data);
      if (reserved.error || !file.success) return { status: "error", message: reserved.error?.code === "P1104" ? "Your account’s media storage allowance is full." : "A file may already be attached or pending. Reload before retrying." };
      const written = await bucket.upload(productFilePath(file.data), bytes, { contentType: "application/pdf", upsert: false });
      if (written.error) return { status: "error", message: "The upload could not be confirmed. Reload, then finish or remove the pending file." };
    } else {
      const listed = await client.rpc("list_my_product_files", { p_profile: input.data.profile });
      const files = z.array(productFile).max(20).safeParse(listed.data);
      const id = z.uuid().safeParse(form.get("fileId"));
      const current = files.success && id.success ? files.data.find((item) => item.productId === input.data.product && item.id === id.data) : null;
      if (listed.error || !current) return { status: "error", message: "This file changed. Reload before trying again." };
      if (input.data.operation === "remove") {
        const marked = await client.rpc("remove_my_product_file", { p_product: current.productId, p_file: current.id });
        const removing = productFile.safeParse(marked.data);
        if (marked.error || !removing.success || removing.data.state !== "removing") return { status: "error", message: marked.error?.code === "P1211"
          ? "This PDF is retained by private versions. Discard those versions before removing it."
          : "File removal could not be started. Reload and retry." };
        const removed = await bucket.remove([productFilePath(removing.data)]);
        if (removed.error) return { status: "error", message: "Removal is pending. Download is disabled; retry removal to release storage." };
        const completed = await admin.rpc("complete_product_file_removal", { p_owner: user.id, p_product: current.productId, p_file: current.id });
        if (completed.error || completed.data !== true) return { status: "error", message: "Removal could not be confirmed. Reload and retry removal." };
        return { status: "success", message: "Private file removed. Its storage reservation is released." };
      }
      if (current.state !== "pending") return { status: "error", message: "Only a pending upload can be finished." };
      file = productFile.safeParse(current);
    }
    if (!file.success) return { status: "error", message: "File unavailable." };
    const stored = await bucket.download(productFilePath(file.data));
    if (stored.error || !stored.data || stored.data.size !== file.data.bytes) return { status: "error", message: "The pending file is unavailable. Remove it and choose the file again." };
    checkProductPdf(new Uint8Array(await stored.data.arrayBuffer()));
    const committed = await admin.rpc("commit_product_file", { p_owner: user.id, p_product: file.data.productId, p_file: file.data.id });
    if (committed.error || committed.data !== true) return { status: "error", message: "The file could not be confirmed under the current media allowance. Reload, then retry finishing or remove it." };
    return { status: "success", message: "Private PDF attached. Only you can download it; it is not available to buyers." };
  } catch {
    return { status: "error", message: "The file could not be processed. Reload to check its state, then remove any pending upload before trying again." };
  } finally {
    revalidatePath("/studio/products");
    revalidatePath("/studio/plan");
  }
}
