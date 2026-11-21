"use client";
import {useActionState} from "react";
import {saveCreatorStock} from "@/app/studio/products/inventory/actions";
import {initialState} from "@/lib/actions";
import {ActionMessage} from "./action-message";

export function CreatorStockForm({profileId,versionId,totalSlots,reserved}:{
  profileId:string;versionId:string;totalSlots:number|null;reserved:number;
}) {
  const [state,submit,pending]=useActionState(saveCreatorStock,initialState);
  const locked=reserved>0;
  return <form action={submit} className="stack">
    <input type="hidden" name="profile" value={profileId}/>
    <input type="hidden" name="version" value={versionId}/>
    <label>Limited test inventory slots (1–50), or blank for unlimited
      <input name="slots" type="number" min={1} max={50} step={1}
        defaultValue={totalSlots??""} disabled={pending||locked}/>
    </label>
    <p className="muted">This counter tracks permanent Checkout slot reservations, not settled sales. Unpaid, expired or refunded attempts still occupy a slot to prevent overselling if Stripe confirms a late payment.</p>
    {locked?<p role="status">Inventory locked: {reserved} slot(s) already reserved. The cap cannot be changed automatically.</p>
      :<button className="button" disabled={pending}>Save inventory cap</button>}
    <ActionMessage state={state}/>
  </form>;
}
