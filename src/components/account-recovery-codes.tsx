"use client";

import { useActionState, useState } from "react";
import { regenerateMfaRecoveryCodes, type RecoveryCodesState } from "@/app/studio/account/actions";

const initial:RecoveryCodesState={error:"",codes:[]};

export function AccountRecoveryCodes({enabled}:{enabled:boolean}){
  const [state,action,pending]=useActionState(regenerateMfaRecoveryCodes,initial);
  const [copied,setCopied]=useState(false);
  return <div className="studio-account-action-control stack">
    <p className="muted">Recovery codes are one-time use. Used codes cannot be reused. A recovery sign-in remains at AAL1 until a new authenticator is enrolled and verified.</p>
    <form action={action}>
      <button className="button small" type="submit" disabled={!enabled||pending}>
        {pending?"Regenerating…":"Regenerate Recovery Codes"}
      </button>
    </form>
    {!enabled&&<p className="muted">Enable authenticator MFA before generating recovery codes.</p>}
    {state.error&&<p className="message error" role="alert">{state.error}</p>}
    {state.codes.length>0&&<>
      <p className="message" role="alert">Save these codes now. They are shown once. Regenerating them invalidates the previous set.</p>
      <textarea readOnly rows={6} value={state.codes.join("\n")} aria-label="Single-use recovery codes"/>
      <button className="button small" type="button" onClick={()=>{
        void navigator.clipboard.writeText(state.codes.join("\n")).then(()=>setCopied(true)).catch(()=>setCopied(false));
      }}>{copied?"Copied":"Copy recovery codes"}</button>
    </>}
  </div>;
}
