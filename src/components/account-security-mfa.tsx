"use client";

import { useActionState } from "react";
import { enrollAccountMfa, verifyAccountMfa, type MfaState } from "@/app/studio/account/actions";

const initial:MfaState={error:"",success:"",factorId:"",qr:""};

export function AccountSecurityMfa({verifiedFactorId}:{verifiedFactorId?:string}){
 const [enrollment,begin,pending]=useActionState(enrollAccountMfa,initial);
 const [verification,verify,verifying]=useActionState(verifyAccountMfa,initial);
 const factor=enrollment.factorId;
 return <div className="stack">
  {verifiedFactorId
   ? <p className="studio-setting-status is-good">Authenticator enabled</p>
   : <form action={begin}><button className="button small" type="submit" disabled={pending}>{pending?"Preparing…":"Set up authenticator app"}</button></form>}
  {enrollment.error&&<p role="alert">{enrollment.error}</p>}
  {enrollment.qr&&<section className="studio-mfa-enrolment stack">
   <p>Scan this QR code in an authenticator app such as Google Authenticator, Microsoft Authenticator or 1Password. Then enter its current six-digit code.</p>
   {/* Supabase returns a data SVG for the QR; it is not an external URL. */}
   {/* eslint-disable-next-line @next/next/no-img-element */}
   <img src={enrollment.qr} alt="QR code for Snoozer authenticator enrolment" width={220} height={220}/>
   <form action={verify} className="stack">
    <input type="hidden" name="factorId" value={factor}/>
    <label>Six-digit code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required/></label>
    <button className="button" type="submit" disabled={verifying}>{verifying?"Verifying…":"Verify and enable MFA"}</button>
   </form>
  </section>}
  {verification.error&&<p role="alert">{verification.error}</p>}
  {verification.success&&<p role="status">{verification.success}</p>}
  <p className="muted">Keep access to your authenticator app. Add the same Snoozer account to a second trusted authenticator as a backup before changing phones.</p>
 </div>;
}
