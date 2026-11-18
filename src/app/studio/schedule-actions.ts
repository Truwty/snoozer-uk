"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/actions";
import { countdownTarget } from "@/lib/countdown";
import { profileRevision } from "@/lib/profile";
import { requireAccount } from "@/lib/profiles-server";

export async function changePublicationSchedule(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z.object({ profile: z.uuid(), operation: z.enum(["create", "cancel", "check"]) }).safeParse({ profile: form.get("profile"), operation: form.get("operation") });
  if (!input.success) return { status: "error", message: "Invalid schedule request. Reload Studio." };
  const { client } = await requireAccount();
  if (input.data.operation === "create") {
    const revision = profileRevision.safeParse(form.get("revision") ?? "-1");
    const time = countdownTarget(String(form.get("publish_at") ?? ""));
    if (!revision.success || !time) return { status: "error", message: "Enter a valid publication date and time in UTC." };
    const { error } = await client.rpc("schedule_publication", { p_profile: input.data.profile, p_expected: revision.data, p_run_at: time.toISOString() });
    if (error) return { status: "error", message: error.code === "40001" ? "The saved draft changed. Reload before scheduling." : error.code === "22023" ? "Choose a UTC time between one minute and 365 days ahead." : error.code === "P1009" || error.code === "P1006" ? "Your plan does not support this scheduled publication." : "Couldn’t schedule this draft. Check your plan limits and try again." };
    revalidatePath("/studio"); revalidatePath("/studio/history");
    return { status: "success", message: "Saved version scheduled. Your live page is unchanged." };
  }
  if (input.data.operation === "cancel") {
    const { error } = await client.rpc("cancel_publication_schedule", { p_profile: input.data.profile });
    if (error) return { status: "error", message: "Couldn’t cancel this schedule. Reload and try again." };
    revalidatePath("/studio"); revalidatePath("/studio/history");
    return { status: "success", message: "Schedule cancelled. Your live page is unchanged." };
  }
  const { data, error } = await client.rpc("run_my_publication_schedule", { p_profile: input.data.profile });
  const result = z.enum(["published", "not_due", "busy", "missing", "blocked", "cancelled"]).safeParse(data);
  if (error || !result.success) return { status: "error", message: "Couldn’t check this schedule. Try again." };
  revalidatePath("/studio"); revalidatePath("/studio/history");
  return { status: result.data === "blocked" ? "error" : "success", message: {
    published: "Scheduled version is now live.", not_due: "This version is not due yet.", busy: "Another publication is in progress. Check again shortly.", missing: "There is no pending schedule.", blocked: "Publication was blocked. Review your plan and profile limits.", cancelled: "This schedule was superseded by another publication.",
  }[result.data] };
}
