"use client";
import { useActionState } from "react";
import { beginCreatorPurchase } from "@/app/store/actions";
import { initialState } from "@/lib/actions";
import { ActionMessage } from "./action-message";

export function CreatorBuyForm({versionId,soldOut=false}:{versionId:string;soldOut?:boolean}) {
  const [state,submit,pending]=useActionState(beginCreatorPurchase,initialState);
  if(soldOut) return <p role="status">This limited test edition has no unreserved slots. New Checkout is unavailable; existing buyers can access Purchases.</p>;
  return <form action={submit} className="stack"><input type="hidden" name="version" value={versionId}/>
    <label className="check"><input type="checkbox" name="sandbox" required disabled={pending}/>I understand this is a test purchase, with a 30-day download window after payment verification and no live payment.</label>
    <button className="button" disabled={pending}>{pending?"Opening test Checkout…":"Open test Checkout"}</button><ActionMessage state={state}/></form>;
}
