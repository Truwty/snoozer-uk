"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/actions";
import { requireAccount } from "@/lib/profiles-server";

export async function requestKofiReview(_: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireAccount();
  const value = form.get("reference");
  const reference = typeof value === "string" ? value.trim() : "";
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(reference)) {
    return { status: "error", message: "Enter the transaction reference from your Ko-fi receipt." };
  }

  const { data, error } = await client.rpc("request_kofi_donation_review", { p_reference: reference });
  if (!error && data === "received") {
    revalidatePath("/studio/plan");
    return { status: "success", message: "Your review request is recorded." };
  }
  if (!error && data === "limited") return { status: "error", message: "You’ve reached the daily review request limit. Try again tomorrow." };
  return { status: "error", message: "Could not record your request. Try again later." };
}
