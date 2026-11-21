"use client";
import { useActionState } from "react";
import { saveAffiliateDisclosure } from "@/app/studio/products/disclosure/actions";
import { initialState } from "@/lib/actions";
import { ActionMessage } from "./action-message";

export function CreatorAffiliateDisclosureForm({profileId,settings}:{
  profileId:string;settings:{revision:number;disclosure:string;enabled:boolean};
}) {
  const [state,submit,pending]=useActionState(saveAffiliateDisclosure,initialState);
  return <form action={submit} className="stack">
    <input type="hidden" name="profile" value={profileId}/>
    <input type="hidden" name="revision" value={settings.revision}/>
    <label>Affiliate or sponsorship disclosure
      <textarea name="disclosure" defaultValue={settings.disclosure} maxLength={500} rows={5}
        disabled={pending} placeholder="For example: Some recommendations may earn me a commission."/>
    </label>
    <label><input type="checkbox" name="enabled" defaultChecked={settings.enabled} disabled={pending}/>
      {" "}Display this disclosure on my eligible sandbox storefront
    </label>
    <p className="muted">Describe your actual relationships accurately. This setting does not automatically label individual sponsored products or substitute for advertising-law compliance. No real sales are enabled.</p>
    <button className="button" disabled={pending}>Save disclosure</button>
    <ActionMessage state={state}/>
  </form>;
}
