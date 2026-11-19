"use client";
import { useActionState } from "react";
import { refreshPurchase } from "@/app/studio/purchases/actions";
import { initialState } from "@/lib/actions";
import { ActionMessage } from "./action-message";

export function PurchaseRefresh({id}:{id:string}) {
  const [state,submit,pending]=useActionState(refreshPurchase,initialState);
  return <form action={submit} className="stack"><input type="hidden" name="order" value={id}/>
    <button className="button small" disabled={pending}>{pending?"Checking Stripe…":"Check payment status"}</button><ActionMessage state={state}/></form>;
}
