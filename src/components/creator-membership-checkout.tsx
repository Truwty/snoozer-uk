"use client";
import {useActionState} from "react";
import {beginMembership,refreshMembershipAction} from "@/app/studio/memberships/actions";
import {initialState} from "@/lib/actions";
import {ActionMessage} from "./action-message";

export function MembershipCheckout({offer,name}:{offer:string;name:string}) {
 const [state,submit,pending]=useActionState(beginMembership,initialState);
 return <form action={submit} className="stack">
  <input type="hidden" name="offer" value={offer}/><input type="hidden" name="name" value={name}/>
  <label><input type="checkbox" name="sandbox" required disabled={pending}/> I understand this is a recurring Stripe test subscription, not a real payment or Snoozer Plus.</label>
  <button className="button" disabled={pending}>Open recurring test Checkout</button><ActionMessage state={state}/>
 </form>;
}
export function MembershipControls({id,canCancel}:{id:string;canCancel:boolean}) {
 const [state,submit,pending]=useActionState(refreshMembershipAction,initialState);
 return <form action={submit} className="stack">
  <input type="hidden" name="id" value={id}/>
  <button name="intent" value="refresh" className="button small" disabled={pending}>Verify current membership</button>
  {canCancel&&<><label><input name="confirm" type="checkbox" disabled={pending}/> End the test subscription at the end of its current billing period.</label>
  <button name="intent" value="cancel" className="button secondary" disabled={pending}>Cancel renewal</button></>}
  <ActionMessage state={state}/>
 </form>;
}
