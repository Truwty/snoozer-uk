"use client";
import {useActionState} from "react";
import {saveMembership} from "@/app/studio/products/memberships/actions";
import {initialState} from "@/lib/actions";
import type {OwnerMembershipOffer} from "@/lib/creator-membership";
import {ActionMessage} from "./action-message";

export function CreatorMembershipForm({profileId,item}:{profileId:string;item?:OwnerMembershipOffer}) {
  const [state,submit,pending]=useActionState(saveMembership,initialState);
  return <form action={submit} className="panel stack">
    <input type="hidden" name="profile" value={profileId}/>
    <input type="hidden" name="id" value={item?.id??""}/>
    <input type="hidden" name="revision" value={item?.revision??0}/>
    <label>Tier name<input name="title" required maxLength={100} defaultValue={item?.title??""} disabled={pending}/></label>
    <label>Proposed monthly price (GBP)<input name="monthly" type="number" min="1" max="100" step="0.01" required defaultValue={((item?.monthlyPence??500)/100).toFixed(2)} disabled={pending}/></label>
    <label>Proposed benefits<textarea name="benefits" maxLength={500} rows={4} defaultValue={item?.benefits??""} disabled={pending}/></label>
    <label><input name="visible" type="checkbox" defaultChecked={item?.visible??false} disabled={pending}/> Show proposal on eligible sandbox store</label>
    <button className="button" name="intent" value="save" disabled={pending}>Save membership proposal</button>
    {item&&<button className="button small" name="intent" value="delete" formNoValidate disabled={pending}>Remove proposal</button>}
    <ActionMessage state={state}/>
  </form>;
}
