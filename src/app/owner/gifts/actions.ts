"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOwner } from "@/lib/owner/auth";
import { siteUrl } from "@/lib/env";

export type GiftLinkState={error:string;shareUrl:string;expiresAt:string};
const empty:GiftLinkState={error:"",shareUrl:"",expiresAt:""};

export async function createOwnerGiftLink(_:GiftLinkState,form:FormData):Promise<GiftLinkState>{
 const plan=z.enum(["plus","pro","studio"]).safeParse(form.get("plan"));
 const duration=z.coerce.number().int().min(1).max(366).safeParse(form.get("duration_days"));
 const expiry=z.coerce.number().int().min(1).max(365).safeParse(form.get("expiry_days"));
 const reason=z.string().trim().min(8).max(500).safeParse(form.get("reason"));
 if(!plan.success||!duration.success||!expiry.success||!reason.success)return {...empty,error:"Choose a plan, valid duration and expiry, and provide an audit reason."};
 const {client}=await requireOwner();
 const {data,error}=await client.rpc("owner_create_gift_link",{
  p_plan:plan.data,p_version:1,p_duration_days:duration.data,p_expiry_days:expiry.data,p_reason:reason.data,
 });
 if(error)return {...empty,error:"Gift link creation was denied. Complete Owner MFA and check the plan and daily issue limit."};
 const result=z.array(z.object({gift_id:z.uuid(),token:z.string().regex(/^[a-f0-9]{32}$/),expires_at:z.string()})).safeParse(data);
 const issued=result.success?result.data[0]:null;
 if(!issued)return {...empty,error:"The gift was created but the one-time token could not be returned. Check the gift list before retrying."};
 return {error:"",shareUrl:new URL("/gift#"+issued.token,siteUrl()).href,expiresAt:issued.expires_at};
}

export async function revokeOwnerGiftLink(form:FormData){
 const id=z.uuid().safeParse(form.get("gift"));
 const reason=z.string().trim().min(8).max(500).safeParse(form.get("reason"));
 if(!id.success)redirect("/owner/gifts?status=invalid");
 if(!reason.success)redirect("/owner/gifts?status=invalid");
 const {client}=await requireOwner();
 const {data,error}=await client.rpc("owner_revoke_gift_link",{p_gift:id.data,p_reason:reason.data});
 redirect("/owner/gifts?status="+(!error&&data===true?"revoked":"denied"));
}
