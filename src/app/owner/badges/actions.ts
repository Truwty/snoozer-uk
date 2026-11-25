"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOwner } from "@/lib/owner/auth";

const uuid=z.uuid();
const reason=z.string().trim().min(8).max(500);
function returnTo(user:string,status:string){redirect("/owner/badges?"+new URLSearchParams({user,status}).toString());}

export async function ownerAwardBadge(form:FormData){
 const profile=uuid.safeParse(form.get("profile"));
 const slug=z.string().max(64).safeParse(form.get("slug"));
 const name=z.string().trim().max(48).safeParse(form.get("name"));
 const description=z.string().trim().max(240).safeParse(form.get("description"));
 const icon=z.string().trim().max(24).safeParse(form.get("icon"));
 const category=z.enum(["community","creator","staff","unique"]).safeParse(form.get("category"));
 const rarity=z.enum(["rare","epic","legendary","mythic"]).safeParse(form.get("rarity"));
 const why=reason.safeParse(form.get("reason"));
 const user=uuid.safeParse(form.get("user"));
 if(!profile.success||!user.success)return redirect("/owner/badges");
 if(!slug.success||!name.success||!description.success||!icon.success||!category.success||!rarity.success||!why.success)
  returnTo(user.data,"invalid");
 const {client}=await requireOwner();
 const {error}=await client.rpc("owner_award_profile_badge",{
  p_profile:profile.data,p_slug:slug.data||null,p_name:name.data||null,
  p_description:description.data||null,p_icon:icon.data||null,
  p_category:category.data,p_rarity:rarity.data,p_reason:why.data,
 });
 returnTo(user.data,error?"denied":"awarded");
}

export async function ownerRevokeBadge(form:FormData){
 const profile=uuid.safeParse(form.get("profile"));
 const badge=uuid.safeParse(form.get("badge"));
 const user=uuid.safeParse(form.get("user"));
 const why=reason.safeParse(form.get("reason"));
 if(!profile.success||!badge.success||!user.success)return redirect("/owner/badges");
 if(!why.success)returnTo(user.data,"invalid");
 const {client}=await requireOwner();
 const {data,error}=await client.rpc("owner_revoke_profile_badge",{p_badge:badge.data,p_reason:why.data});
 returnTo(user.data,error||data!==true?"denied":"revoked");
}
