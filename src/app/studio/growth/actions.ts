"use server";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/actions";
import { requireAccount } from "@/lib/profiles-server";

export async function changeGrowth(_: ActionState, form: FormData): Promise<ActionState> {
  const operation = form.get("operation");
  if (!["enable", "disable", "accept", "withdraw"].includes(String(operation))) return { status: "error", message: "Choose a referral action." };
  const { client } = await requireAccount();
  const result = operation === "accept" ? await client.rpc("accept_my_referral")
    : operation === "withdraw" ? await client.rpc("withdraw_my_referral")
    : await client.rpc("set_my_referral_enabled", { p_enabled: operation === "enable" });
  if (result.error) return { status: "error", message: "Couldn’t change referrals. Publish a profile before enabling your link, or try again later." };
  if (operation === "accept" && result.data === "ineligible") return { status: "error", message: "Referral credit is unavailable. It requires your signup consent, an eligible creator link and email verification within 24 hours of signup." };
  revalidatePath("/studio/growth");
  return { status: "success", message: operation === "withdraw" ? "Referral attribution withdrawn. You cannot be attributed again." : operation === "accept" ? "Referral choice recorded. Check your current status below." : operation === "enable" ? "Referral link enabled." : "Referral link disabled. Previous consented attribution remains until withdrawal or account deletion." };
}
