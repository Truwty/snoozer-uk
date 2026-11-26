"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOwner } from "@/lib/owner/auth";

export async function reviewCommunityTemplate(form: FormData) {
  const id=z.uuid().safeParse(form.get("id")); const status=z.enum(["approved","rejected"]).safeParse(form.get("status"));
  if(!id.success||!status.success) redirect("/owner/community-templates?error=invalid");
  const {client}=await requireOwner();
  const {data,error}=await client.rpc("owner_review_community_template",{p_id:id.data,p_status:status.data});
  if(error||!data) redirect("/owner/community-templates?error=failed");
  revalidatePath("/owner/community-templates"); revalidatePath("/studio/templates");
  redirect("/owner/community-templates?saved=1");
}
