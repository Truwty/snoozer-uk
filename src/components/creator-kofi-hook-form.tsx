"use client";
import {useActionState} from "react";
import {saveCreatorKofiHook} from "@/app/studio/donations/actions";
import {initialState} from "@/lib/actions";
import {ActionMessage} from "./action-message";
export function CreatorKofiHookForm({profile,revision,enabled}:{profile:string;revision:number;enabled:boolean}) {
 const [state,action,pending]=useActionState(saveCreatorKofiHook,initialState);
 return <form className="stack" action={action}>
  <input type="hidden" name="profile" value={profile}/><input type="hidden" name="revision" value={revision}/>
  <p>Current reporting status: <strong>{enabled?"Enabled":"Disabled"}</strong>. The Ko-fi verification token is hashed before storage and never shown again.</p>
  <label>Ko-fi webhook verification token (leave blank to keep the saved token)
   <input name="token" type="password" autoComplete="off" minLength={16} maxLength={128} disabled={pending} placeholder="Paste from your own Ko-fi Webhooks settings"/>
  </label>
  <p>Before enabling, configure your Ko-fi webhook to send to the Snoozer endpoint shown below. Never paste a Stripe, PayPal or Snoozer login secret here.</p>
  <div className="row">
   <button className="button" name="intent" value="enable" disabled={pending}>Save and enable reporting</button>
   <button className="button secondary" name="intent" value="disable" disabled={pending}>Disable reporting</button>
  </div>
  <ActionMessage state={state}/>
 </form>;
}
