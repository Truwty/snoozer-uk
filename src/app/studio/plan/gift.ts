"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/actions";
import { requireAccount } from "@/lib/profiles-server";

export async function redeemGiftCode(_: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireAccount();
  const value = form.get("code");
  const code = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!/^[a-f0-9]{32}$/.test(code)) {
    return { status: "error", message: "Enter a valid gift code." };
  }

  const { data, error } = await client.rpc("redeem_gift_code", { p_code: code });
  if (error) return { status: "error", message: "Could not redeem your gift code. Try again later." };
  if (data !== true) return { status: "error", message: "That gift code is unavailable." };
  revalidatePath("/studio/plan");
  return { status: "success", message: "Gift redeemed." };
}
