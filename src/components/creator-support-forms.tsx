"use client";
import {useActionState} from "react";
import {initialState} from "@/lib/actions";
import {openCreatorSupportCase,closeCreatorSupportCase,answerCreatorSupportCase} from "@/app/studio/support/actions";
import {ActionMessage} from "./action-message";
import {supportIssueLabels} from "@/lib/creator-support";

export function CreatorSupportForm({kind="purchase",reference=""}:{kind?:"purchase"|"membership";reference?:string}) {
 const [state,action,pending]=useActionState(openCreatorSupportCase,initialState);
 return <form action={action} className="stack">
  <label>Reference type
   <select name="kind" required defaultValue={kind} disabled={pending}><option value="purchase">PDF purchase</option><option value="membership">Membership</option></select>
  </label>
  <label>Purchase or membership reference (UUID)
   <input name="reference" type="text" required maxLength={36} defaultValue={reference} placeholder="Paste your reference from Purchases or Memberships" disabled={pending}/>
  </label>
  <label>Issue
   <select name="issue" required defaultValue="delivery" disabled={pending}>
    {Object.entries(supportIssueLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}
   </select>
  </label>
  <label>What happened? (20–1,500 characters)
   <textarea name="message" minLength={20} maxLength={1500} rows={4} required disabled={pending} placeholder="Describe the problem and any steps you tried. Never share passwords, card numbers or login codes."/>
  </label>
  <button className="button" disabled={pending}>Submit private support case</button>
  <ActionMessage state={state}/>
 </form>;
}
export function CloseSupportCase({id}:{id:string}) {
 const [state,action,pending]=useActionState(closeCreatorSupportCase,initialState);
 return <form action={action} className="stack">
  <input type="hidden" name="id" value={id}/>
  <button className="button secondary small" disabled={pending}>Close this case</button>
  <ActionMessage state={state}/>
 </form>;
}
export function StaffSupportReply({id}:{id:string}) {
 const [state,action,pending]=useActionState(answerCreatorSupportCase,initialState);
 return <form action={action} className="stack">
  <input type="hidden" name="id" value={id}/>
  <label>Private response to buyer (20–1,500 characters)
   <textarea name="response" minLength={20} maxLength={1500} rows={3} required disabled={pending}/>
  </label>
  <button className="button" disabled={pending}>Save private staff reply</button>
  <ActionMessage state={state}/>
 </form>;
}
