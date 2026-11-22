"use server";
import {redirect} from "next/navigation";
import {requireOwner} from "@/lib/owner/auth";
import {dispatchOwnerNoticeEmails} from "@/lib/owner/notification-delivery";

export async function runOwnerNoticeDelivery() {
 const {client}=await requireOwner();
 const assurance=await client.auth.mfa.getAuthenticatorAssuranceLevel();
 if(assurance.error||assurance.data?.currentLevel!=="aal2")
  redirect("/owner/system?mail=mfa-required");
 const delivery=await dispatchOwnerNoticeEmails();
 redirect("/owner/system?mail="+delivery.status+
   "&sent="+encodeURIComponent(String(delivery.sent))+
   "&failed="+encodeURIComponent(String(delivery.failed)));
}
