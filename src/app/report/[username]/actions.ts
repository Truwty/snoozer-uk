"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { sessionClient } from "@/lib/supabase";
import { username as usernameSchema } from "@/lib/profile";

export async function submitReport(form:FormData) {
 const name=usernameSchema.safeParse(form.get("username"));
 const category=z.enum(["spam","phishing","impersonation","harassment","malware","copyright","other"]).safeParse(form.get("category"));
 const reason=z.string().trim().min(15).max(1000).safeParse(form.get("reason"));
 if(!name.success)redirect("/");
 if(!category.success||!reason.success)redirect("/report/"+name.data+"?status=invalid");
 const client=await sessionClient();
 const {data:user}=await client.auth.getUser();
 if(!user.user?.email_confirmed_at)redirect("/sign-in");
 const {error}=await client.rpc("submit_profile_report",{p_name:name.data,p_category:category.data,p_reason:reason.data});
 redirect("/report/"+name.data+"?status="+(error?"denied":"received"));
}
