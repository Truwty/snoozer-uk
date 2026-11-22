"use server";
import {redirect} from "next/navigation";
import {z} from "zod";
import {sessionClient} from "@/lib/supabase";
export async function submitAppeal(form:FormData) {
 const id=z.uuid().safeParse(form.get("case"));
 const reason=z.string().trim().min(15).max(1000).safeParse(form.get("reason"));
 if(!id.success||!reason.success)redirect("/appeal?status=invalid");
 const client=await sessionClient();
 const {data}=await client.auth.getUser();
 if(!data.user?.email_confirmed_at)redirect("/sign-in");
 const result=await client.rpc("submit_moderation_appeal",{p_case:id.data,p_reason:reason.data});
 redirect("/appeal?status="+(result.error?"denied":"received"));
}
