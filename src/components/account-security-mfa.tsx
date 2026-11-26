"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { enrollAccountMfa, verifyAccountMfa, type MfaState } from "@/app/studio/account/actions";

const initial:MfaState={error:"",success:"",factorId:"",qr:"",secret:""};

export function AccountSecurityMfa({verifiedFactorIds}:{verifiedFactorIds:string[]}){
 const [enrollment,begin,pending]=useActionState(enrollAccountMfa,initial);
 const [verification,verify,verifying]=useActionState(verifyAccountMfa,initial);
 const [recovery,recover,regenerating]=useActionState(regenerateMfaRecoveryCodes,recoveryInitial);
 const [copied,setCopied]=useState(false);
 const router=useRouter();
 const factor=enrollment.factorId;
 useEffect(()=>{if(verification.success)router.refresh();},[verification.success,router]);
 return <div className="stack">
  {verifiedFactorIds.length>0
   ? <p className="studio-setting-status is-good">{verifiedFactorIds.length} authenticator {verifiedFactorIds.length===1?"factor":"factors"} enabled</p>
   : <p className="muted">No authenticator is enabled yet.</p>}
  {verifiedFactorIds.length<10&&<form action={begin}><button className="button small" type="submit" disabled={pending}>{pending?"Preparing…":verifiedFactorIds.length>0?"Add backup authenticator":"Set up authenticator app"}</button></form>}
  {enrollment.error&&<p role="alert">{enrollment.error}</p>}
  {enrollment.qr&&!verification.success&&<section className="studio-mfa-enrolment stack">
   <p>Scan this QR code in an authenticator app such as Google Authenticator, Microsoft Authenticator or 1Password. Then enter its current six-digit code.</p>
   {/* Supabase returns a data SVG for the QR; it is not an external URL. */}
   {/* eslint-disable-next-line @next/next/no-img-element */}
   <img src={enrollment.qr} alt="QR code for Snoozer authenticator enrolment" width={220} height={220}/>
   <p>Can’t scan the QR? Enter this setup key manually in your authenticator app:</p>
   <code className="studio-mfa-secret">{enrollment.secret}</code>
   <form action={verify} className="stack">
    <input type="hidden" name="factorId" value={factor}/>
    <label>Six-digit code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required/></label>
    <button className="button" type="submit" disabled={verifying}>{verifying?"Verifying…":"Verify and enable MFA"}</button>
   </form>
  </section>}
  {verification.error&&<p role="alert">{verification.error}</p>}
  {verification.success&&<p role="status">{verification.success}</p>}
  <p className="muted">Keep access to your authenticator app. Add a second authenticator on another trusted device as a backup before changing phones.</p>
 </div>;
}
