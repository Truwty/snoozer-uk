"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { sessionClient } from "@/lib/supabase";
import { username as usernameSchema } from "@/lib/profile";

function reportHref(name: string, entry: string | undefined, status: string) {
 const params = new URLSearchParams();
 if (entry) params.set("entry", entry);
 params.set("status", status);
 return "/report/" + name + "?" + params.toString();
}

export async function submitReport(form:FormData) {
 const name=usernameSchema.safeParse(form.get("username"));
 const rawEntry=form.get("entry");
 const entry=rawEntry ? z.uuid().safeParse(rawEntry) : null;
 const category=z.enum(["spam","phishing","impersonation","harassment","malware","copyright","other"]).safeParse(form.get("category"));
 const reason=z.string().trim().min(15).max(1000).safeParse(form.get("reason"));
 if(!name.success)redirect("/");
 if(rawEntry && !entry?.success)redirect("/report/"+name.data+"?status=invalid");
 const entryId=entry?.success?entry.data:undefined;
 if(!category.success||!reason.success)redirect(reportHref(name.data,entryId,"invalid"));
 const client=await sessionClient();
 const {data:user}=await client.auth.getUser();
 if(!user.user?.email_confirmed_at)redirect("/sign-in");
 const {error}=entryId
   ? await client.rpc("submit_guestbook_entry_report",{p_name:name.data,p_entry:entryId,p_category:category.data,p_reason:reason.data})
   : await client.rpc("submit_profile_report",{p_name:name.data,p_category:category.data,p_reason:reason.data});
 redirect(reportHref(name.data,entryId,error?"denied":"received"));
}
