"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { sessionClient } from "@/lib/supabase";

export async function requestDataAction(form: FormData) {
 const kind=z.enum(["export","deletion"]).safeParse(form.get("kind"));
 if(!kind.success) redirect("/account/data?status=invalid");
 const client=await sessionClient();
 const {data,error}=await client.rpc("request_my_privacy_action",{p_kind:kind.data});
 redirect("/account/data?status="+(!error&&z.uuid().safeParse(data).success?"received":"denied"));
}
export async function readNotification(form: FormData) {
 const id=z.uuid().safeParse(form.get("id"));
 if(!id.success) redirect("/account/notifications");
 const client=await sessionClient();
 await client.rpc("mark_account_notification_read",{p_id:id.data});
 redirect("/account/notifications");
}
