"use server";
import { requireOwner } from "@/lib/owner/auth";
import { z } from "zod";

export type MfaResult={error:string;success:string;factorId:string;qr:string};
const mfaInitial:MfaResult={error:"",success:"",factorId:"",qr:""};
export async function enrollOwnerMfa(_:MfaResult):Promise<MfaResult> {
 const {client}=await requireOwner();
 const {data,error}=await client.auth.mfa.enroll({factorType:"totp",friendlyName:"Snoozer Owner"});
 if(error||!data?.totp?.qr_code)return {...mfaInitial,error:"Unable to start MFA enrollment."};
 return {...mfaInitial,factorId:data.id,qr:data.totp.qr_code};
}
export async function verifyOwnerMfa(_:MfaResult,form:FormData):Promise<MfaResult> {
 const factorId=z.uuid().safeParse(form.get("factorId"));
 const code=z.string().regex(/^\d{6}$/).safeParse(form.get("code"));
 if(!factorId.success||!code.success)return {...mfaInitial,error:"Enter a valid six-digit code."};
 const {client}=await requireOwner();
 const {error}=await client.auth.mfa.challengeAndVerify({factorId:factorId.data,code:code.data});
 if(error)return {...mfaInitial,error:"Verification failed. Check the authenticator code."};
 return {...mfaInitial,success:"MFA verified. You can now use protected Owner actions."};
}
