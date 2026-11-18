"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/actions";
import { productDescription, productPrice, productTitle } from "@/lib/products";
import { requireAccount } from "@/lib/profiles-server";

export async function saveProductDraft(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z.object({ profile: z.uuid(), id: z.uuid().nullable(), expected: z.coerce.number().int().min(0).max(2147483646),
    title: productTitle, description: productDescription, amount: productPrice, archived: z.enum(["true", "false"]) }).safeParse({
    profile: form.get("profile"), id: form.get("id") || null, expected: form.get("revision"), title: form.get("title"),
    description: form.get("description"), amount: form.get("price"), archived: form.get("archived"),
  });
  if (!input.success) return { status: "error", message: "Enter a title (1–100 characters), description up to 2,000 characters and a GBP price from £0.50 to £1,000.00 with at most two decimal places." };
  const { client } = await requireAccount();
  const value = input.data;
  const result = await client.rpc("save_product_draft", { p_profile: value.profile, p_id: value.id, p_expected: value.expected,
    p_title: value.title, p_description: value.description, p_amount: value.amount, p_archived: value.archived === "true" });
  if (result.error) return { status: "error", message: result.error.code === "40001" ? "This product changed in another window. Reload before saving."
    : result.error.code === "P1201" ? "Your catalogue allows five active drafts and twenty total, including archived products. Archive an active draft before restoring another."
      : "Couldn’t save this product. Check profile ownership and try again." };
  if (!z.uuid().safeParse(result.data).success) return { status: "error", message: "The save could not be confirmed. Reload before retrying." };
  revalidatePath("/studio/products");
  return { status: "success", message: value.archived === "true" ? "Product archived privately. You can restore it here." : "Product draft saved privately. It is not for sale." };
}
