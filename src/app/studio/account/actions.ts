"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/actions";
import { requireAccount } from "@/lib/profiles-server";
import { siteUrl } from "@/lib/env";
import { safeNextPath } from "@/lib/account-security";
import { sessionClient } from "@/lib/supabase";

const fail=(message:string):ActionState=>({status:"error",message});
const ok=(message:string):ActionState=>({status:"success",message});

export async function changeEmail(_:ActionState,form:FormData):Promise<ActionState>{
 const parsed=z.email().max(254).safeParse(form.get("email"));
 if(!parsed.success)return fail("Enter a valid email address.");
 const {client,user}=await requireAccount();
 if(user.email?.toLowerCase()===parsed.data.toLowerCase())return fail("That is already your account email address.");
 const {error}=await client.auth.updateUser({email:parsed.data},{
  emailRedirectTo:new URL("/auth/confirm?type=email_change",siteUrl()).href,
 });
 if(error?.status===429)return fail("Too many email-change requests. Try again later.");
 if(error)return fail("Could not start the email change. Check the address and try again.");
 return ok("Confirmation instructions have been sent. Your current email stays active until verification is complete.");
}

export async function revokeDeviceSession(form:FormData){
 const id=z.uuid().safeParse(form.get("session"));
 if(!id.success)redirect("/studio/account?session=invalid");
 const {client}=await requireAccount();
 const {data,error}=await client.rpc("revoke_my_device_session",{p_session:id.data});
 if(error||data!==true)redirect("/studio/account?session=failed");
 revalidatePath("/studio/account");
 redirect("/studio/account?session=revoked");
}

export async function unlinkSignInIdentity(form: FormData) {
 const input=z.object({provider:z.enum(["google","discord"]),confirm:z.literal("on")}).safeParse({
  provider:form.get("provider"),confirm:form.get("confirm_unlink"),
 });
 if(!input.success)redirect("/studio/account?identity=invalid");
 const {client}=await requireAccount("/studio/account");
 const {data,error:identityError}=await client.auth.getUserIdentities();
 if(identityError||!data)redirect("/studio/account?identity=unavailable");
 const identities=data.identities;
 const target=identities.find(identity=>identity.provider===input.data.provider);
 if(!target)redirect("/studio/account?identity=missing");
 if(identities.length<2)redirect("/studio/account?identity=last");
 if(input.data.provider==="discord"){
  const {error}=await client.rpc("discord_presence_disconnect");
  if(error)redirect("/studio/account?identity=presencefailed");
 }
 const {error}=await client.auth.unlinkIdentity(target);
 if(error)redirect("/studio/account?identity=failed");
 revalidatePath("/studio/account");
 revalidatePath("/studio/discord");
 redirect("/studio/account?identity=unlinked");
}

export async function updateMarketingPreference(form: FormData) {
 const enabled=z.enum(["true","false"]).safeParse(form.get("email_opt_in"));
 if(!enabled.success)redirect("/studio/account?marketing=invalid");
 const {client}=await requireAccount("/studio/account");
 const {error}=await client.rpc("set_my_marketing_preference",{p_email_opt_in:enabled.data==="true"});
 if(error)redirect("/studio/account?marketing=failed");
 revalidatePath("/studio/account");
 redirect("/studio/account?marketing=saved");
}

export type MfaState={error:string;success:string;factorId:string;qr:string;secret:string};
const emptyMfa:MfaState={error:"",success:"",factorId:"",qr:"",secret:""};

export async function enrollAccountMfa(_:MfaState):Promise<MfaState>{
 void _;
 const {client}=await requireAccount();
 const listed=await client.auth.mfa.listFactors();
 if(listed.error)return {...emptyMfa,error:"Could not read your authenticator factors."};
 const verified=listed.data?.totp?.find(f=>f.status==="verified");
 if(verified)return {...emptyMfa,success:"Authenticator MFA is already enabled."};
 for(const pending of listed.data?.all?.filter(f=>f.factor_type==="totp"&&f.status==="unverified")??[]){
  await client.auth.mfa.unenroll({factorId:pending.id});
 }
 const {data,error}=await client.auth.mfa.enroll({factorType:"totp",friendlyName:"Snoozer account"});
 if(error||!data?.totp?.qr_code||!data.totp.secret)return {...emptyMfa,error:"Could not start authenticator enrolment."};
 return {...emptyMfa,factorId:data.id,qr:data.totp.qr_code,secret:data.totp.secret};
}

export async function verifyAccountMfa(_:MfaState,form:FormData):Promise<MfaState>{
 const factor=z.uuid().safeParse(form.get("factorId"));
 const code=z.string().regex(/^\d{6}$/).safeParse(form.get("code"));
 if(!factor.success||!code.success)return {...emptyMfa,error:"Enter the six-digit code from your authenticator app."};
 const {client}=await requireAccount();
 const {error}=await client.auth.mfa.challengeAndVerify({factorId:factor.data,code:code.data});
 if(error)return {...emptyMfa,factorId:factor.data,error:"That code was not accepted. Check the time on your device and try again."};
 await client.rpc("refresh_my_profile_badges");
 revalidatePath("/studio/account");
 return {...emptyMfa,success:"Authenticator MFA is enabled. New sign-ins will now require a one-time code."};
}

export async function disableAccountMfa(form:FormData){
 const factor=z.uuid().safeParse(form.get("factorId"));
 if(!factor.success)redirect("/studio/account?mfa=invalid");
 const {client}=await requireAccount();
 const assurance=await client.auth.mfa.getAuthenticatorAssuranceLevel();
 if(assurance.error||assurance.data?.currentLevel!=="aal2")redirect("/auth/mfa?next=%2Fstudio%2Faccount");
 const {error}=await client.auth.mfa.unenroll({factorId:factor.data});
 if(error)redirect("/studio/account?mfa=failed");
 revalidatePath("/studio/account");
 redirect("/studio/account?mfa=disabled");
}

export async function verifyLoginMfa(form:FormData){
 const factor=z.uuid().safeParse(form.get("factorId"));
 const code=z.string().regex(/^\d{6}$/).safeParse(form.get("code"));
 const next=safeNextPath(form.get("next"));
 if(!factor.success||!code.success)redirect("/auth/mfa?failed=1&next="+encodeURIComponent(next));
 const client=await sessionClient();
 const user=await client.auth.getUser();
 if(!user.data.user?.email_confirmed_at)redirect("/sign-in");
 const listed=await client.auth.mfa.listFactors();
 const valid=listed.data?.totp?.some(item=>item.id===factor.data&&item.status==="verified");
 if(!valid)redirect("/auth/mfa?failed=1&next="+encodeURIComponent(next));
 const {error}=await client.auth.mfa.challengeAndVerify({factorId:factor.data,code:code.data});
 if(error)redirect("/auth/mfa?failed=1&next="+encodeURIComponent(next));
 await client.rpc("refresh_my_profile_badges");
 redirect(next);
}

export async function claimGiftLink(_:ActionState,form:FormData):Promise<ActionState>{
 const token=z.string().regex(/^[a-f0-9]{32}$/i).safeParse(form.get("token"));
 if(!token.success)return fail("This gift link is invalid or incomplete.");
 const {client}=await requireAccount("/gift");
 const {data,error}=await client.rpc("claim_gift_link",{p_token:token.data.toLowerCase()});
 if(error)return fail("Could not claim this gift right now. Try again later.");
 if(!data)return fail("This gift link has already been claimed, expired or been revoked.");
 await client.rpc("refresh_my_profile_badges");
 const details=z.object({plan:z.enum(["plus","pro","studio"]),duration_days:z.number().int(),expires_at:z.string()}).safeParse(data);
 if(!details.success)return fail("The gift was processed, but its confirmation could not be read. Check your plan page.");
 revalidatePath("/studio/plan");
 revalidatePath("/studio/badges");
 return ok(details.data.plan.toUpperCase()+" has been added to your account for "+details.data.duration_days+" days.");
}
