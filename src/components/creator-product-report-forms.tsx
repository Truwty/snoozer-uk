"use client";
import {useActionState} from "react";
import {initialState} from "@/lib/actions";
import {submitCreatorProductReport,decideCreatorProductReport} from "@/app/studio/product-reports/actions";
import {ActionMessage} from "./action-message";
import {reasonLabels} from "@/lib/creator-product-moderation";
export function ProductReportForm({versionId=""}:{versionId?:string}) {
 const [state,submit,pending]=useActionState(submitCreatorProductReport,initialState);
 return <form action={submit} className="stack">
  <label>Public reviewed product version
   <input name="versionId" type="text" required maxLength={36} defaultValue={versionId} disabled={pending} placeholder="Paste product version UUID"/>
  </label>
  <label>Reason
   <select name="reason" defaultValue="malware" required disabled={pending}>
    {Object.entries(reasonLabels).map(([id,label])=><option key={id} value={id}>{label}</option>)}
   </select>
  </label>
  <label>Explain the concern (25–1,200 characters)
   <textarea name="detail" minLength={25} maxLength={1200} required rows={4} disabled={pending}
    placeholder="Include a clear description but no passwords, personal data or malicious file contents."/>
  </label>
  <button className="button" disabled={pending}>Send private product report</button>
  <ActionMessage state={state}/>
 </form>;
}
export function ModeratorDecisionForm({id}:{id:string}) {
 const [state,submit,pending]=useActionState(decideCreatorProductReport,initialState);
 return <form action={submit} className="stack">
  <input type="hidden" name="id" value={id}/>
  <label><input type="checkbox" name="confirm" disabled={pending}/> I have reviewed the report and independently verified the product risk. Quarantine cannot be undone through this form.</label>
  <div className="row">
   <button className="button secondary" name="decision" value="dismiss" disabled={pending}>Dismiss reviewed report</button>
   <button className="button" name="decision" value="quarantine" disabled={pending}>Quarantine reviewed version</button>
  </div>
  <ActionMessage state={state}/>
 </form>;
}
