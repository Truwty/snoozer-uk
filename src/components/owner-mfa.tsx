"use client";
import {useActionState} from "react";
import {enrollOwnerMfa,verifyOwnerMfa} from "@/app/owner/security/actions";
const mfaInitial={error:"",success:"",factorId:"",qr:""};
export function OwnerMfa({verifiedFactorId}:{verifiedFactorId?:string}) {
 const [enrollment,begin,pending]=useActionState(enrollOwnerMfa,mfaInitial);
 const [verification,verify,verifying]=useActionState(verifyOwnerMfa,mfaInitial);
 const factor=enrollment.factorId||verifiedFactorId;
 return <div className="stack">
 {!verifiedFactorId&&<form action={begin} className="stack"><button className="button" disabled={pending}>Set up authenticator app</button></form>}
 {enrollment.error&&<p role="alert">{enrollment.error}</p>}
 {enrollment.qr&&<div className="panel stack"><p>Scan this QR code in your authenticator app, then enter the six-digit code.</p>
 {/* Supabase supplies the QR as an SVG data URI, not an external URL. */}
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img src={enrollment.qr} alt="Authenticator enrollment QR" width={220} height={220}/>
 </div>}
 {factor&&<form action={verify} className="stack"><input type="hidden" name="factorId" value={factor}/>
 <label>Six-digit authenticator code<input name="code" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} autoComplete="one-time-code" required/></label>
 <button className="button" disabled={verifying}>Verify MFA</button></form>}
 {verification.error&&<p role="alert">{verification.error}</p>}{verification.success&&<p role="status">{verification.success}</p>}
 </div>;
}
