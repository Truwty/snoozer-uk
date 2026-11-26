"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAccount } from "@/lib/profiles-server";

const idSchema=z.uuid();
const titleSchema=z.string().trim().min(1).max(80);
const bodySchema=z.string().min(1).max(16384).refine(value=>new TextEncoder().encode(value).byteLength<=16384);
const profileSchema=z.uuid().nullable();
function destination(profile:string|null,status:string) {
 const query=new URLSearchParams({paste:status}); if(profile)query.set("profile",profile);
 return "/studio/image-host?"+query.toString();
}

export async function createTextPaste(form:FormData) {
 const profile=profileSchema.safeParse(form.get("profile")||null);
 const title=titleSchema.safeParse(form.get("title")); const body=bodySchema.safeParse(form.get("body"));
 if(!profile.success||!title.success||!body.success)redirect(destination(null,"invalid"));
 const {client}=await requireAccount();
 const {error}=await client.rpc("create_my_image_host_text_paste",{
  p_title:title.data,p_body:body.data,p_is_public:form.get("is_public")==="on",
 });
 if(error)redirect(destination(profile.data,error.code==="P1210"?"limit":"failed"));
 revalidatePath("/studio/image-host");
 redirect(destination(profile.data,"created"));
}

export async function updateTextPaste(form:FormData) {
 const profile=profileSchema.safeParse(form.get("profile")||null); const id=idSchema.safeParse(form.get("id"));
 const title=titleSchema.safeParse(form.get("title")); const body=bodySchema.safeParse(form.get("body"));
 if(!profile.success||!id.success||!title.success||!body.success)redirect(destination(null,"invalid"));
 const {client}=await requireAccount();
 const {data,error}=await client.rpc("update_my_image_host_text_paste",{
  p_id:id.data,p_title:title.data,p_body:body.data,p_is_public:form.get("is_public")==="on",
 });
 if(error||data!==true)redirect(destination(profile.data,"failed"));
 revalidatePath("/studio/image-host"); revalidatePath(`/paste/${id.data}`);
 redirect(destination(profile.data,"saved"));
}

export async function deleteTextPaste(form:FormData) {
 const profile=profileSchema.safeParse(form.get("profile")||null); const id=idSchema.safeParse(form.get("id"));
 if(!profile.success||!id.success)redirect(destination(null,"invalid"));
 const {client}=await requireAccount();
 const {data,error}=await client.rpc("delete_my_image_host_text_paste",{p_id:id.data});
 if(error||data!==true)redirect(destination(profile.data,"failed"));
 revalidatePath("/studio/image-host"); revalidatePath(`/paste/${id.data}`);
 redirect(destination(profile.data,"deleted"));
}
