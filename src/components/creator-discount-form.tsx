"use client";
import { useActionState } from "react";
import { createCreatorDiscount,disableCreatorDiscount } from "@/app/studio/products/discounts/actions";
import { initialState } from "@/lib/actions";
import { ActionMessage } from "./action-message";

type Version={id:string;title:string;revision:number;amount:number};
export function CreatorDiscountForm({profileId,versions}:{profileId:string;versions:Version[]}) {
  const [state,submit,pending]=useActionState(createCreatorDiscount,initialState);
  return <form action={submit} className="stack">
    <input type="hidden" name="profile" value={profileId}/>
    <label>Frozen PDF version<select name="version" required disabled={pending}>{versions.map(v=><option key={v.id} value={v.id}>{v.title} · revision {v.revision} · £{(v.amount/100).toFixed(2)} · {v.id.slice(0,8)}</option>)}</select></label>
    <label>Code<input name="code" required minLength={3} maxLength={24} pattern={String.raw`[A-Za-z0-9][A-Za-z0-9\-]{2,23}`} placeholder="SAVE20" disabled={pending}/></label>
    <label>Percentage off<input name="percent" type="number" min={1} max={90} step={1} defaultValue={20} required disabled={pending}/></label>
    <label>Reservation limit<input name="uses" type="number" min={1} max={50} step={1} defaultValue={5} required disabled={pending}/></label>
    <label>Valid for days<input name="days" type="number" min={1} max={30} step={1} defaultValue={7} required disabled={pending}/></label>
    <button className="button" disabled={pending}>{pending?"Creating…":"Create test discount"}</button><ActionMessage state={state}/>
  </form>;
}
export function DisableCreatorDiscountForm({profileId,id}:{profileId:string;id:string}) {
  const [state,submit,pending]=useActionState(disableCreatorDiscount,initialState);
  return <form action={submit} className="stack"><input type="hidden" name="profile" value={profileId}/><input type="hidden" name="id" value={id}/>
    <button className="button small" disabled={pending}>{pending?"Disabling…":"Permanently disable code"}</button><ActionMessage state={state}/></form>;
}
