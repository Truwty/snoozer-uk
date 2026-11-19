"use client";
import { useActionState } from "react";
import { manageCreatorOffer } from "@/app/studio/products/offer-actions";
import type { CreatorOffer } from "@/lib/creator-store";
import { initialState } from "@/lib/actions";
import { ActionMessage } from "./action-message";

export function CreatorOfferForm({offer,canPublish}:{offer:CreatorOffer;canPublish:boolean}) {
  const [state,submit,pending]=useActionState(manageCreatorOffer,initialState);
  return <form action={submit} className="stack"><input type="hidden" name="version" value={offer.versionId}/>
    <p>{offer.enabled?"Enabled for sandbox testing":"Not published"} · fixture review expires <time dateTime={offer.reviewExpiresAt}>{new Date(offer.reviewExpiresAt).toUTCString()}</time>. Publication requires a public profile and a freshly checked ready seller.</p>
    <div className="actions"><button className="button small" name="operation" value="publish" disabled={pending||!canPublish}>Publish reviewed test version</button>
      <button className="button small" name="operation" value="withdraw" disabled={pending}>Withdraw test offer</button></div><ActionMessage state={state}/></form>;
}
