"use client";

import { useActionState } from "react";
import { createOwnerGiftLink, type GiftLinkState } from "@/app/owner/gifts/actions";

const initial:GiftLinkState={error:"",shareUrl:"",expiresAt:""};

export function OwnerGiftCreator(){
 const [state,submit,pending]=useActionState(createOwnerGiftLink,initial);
 async function copy(){
  if(!state.shareUrl)return;
  try{await navigator.clipboard.writeText(state.shareUrl);}catch{/* The read-only field remains selectable as a fallback. */}
 }
 return <form action={submit} className="stack owner-gift-create">
  <div className="owner-gift-form-grid">
   <label>Premium plan<select name="plan" defaultValue="plus"><option value="plus">Plus</option><option value="pro">Pro</option><option value="studio">Studio</option></select></label>
   <label>Premium duration (days)<input type="number" name="duration_days" min={1} max={366} defaultValue={30} required/></label>
   <label>Link expires in (days)<input type="number" name="expiry_days" min={1} max={365} defaultValue={30} required/></label>
  </div>
  <label>Issue reason (audited)<textarea name="reason" minLength={8} maxLength={500} required placeholder="Why is this Premium gift being issued?"/></label>
  <button className="button" type="submit" disabled={pending}>{pending?"Issuing…":"Create one-time gift link"}</button>
  {state.error&&<p role="alert">{state.error}</p>}
  {state.shareUrl&&<section className="owner-gift-issued stack" aria-live="polite">
   <strong>Gift link created. Copy it now — the secret is only shown once.</strong>
   <input aria-label="One-time gift link" readOnly value={state.shareUrl} onFocus={(event)=>event.currentTarget.select()}/>
   <p className="muted">Expires {new Date(state.expiresAt).toLocaleString("en-GB")}. The link is single-use and the secret is not stored in plaintext.</p>
   <button type="button" className="button small" onClick={copy}>Copy gift link</button>
  </section>}
 </form>;
}
