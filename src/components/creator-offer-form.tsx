"use client";
import { useActionState } from "react";
import { manageCreatorOffer } from "@/app/studio/products/offer-actions";
import type { CreatorOffer } from "@/lib/creator-store";
import { creatorOfferStatus } from "@/lib/creator-qa-studio";
import { initialState } from "@/lib/actions";
import { ActionMessage } from "./action-message";

export function CreatorOfferForm({offer,canPublish}:{offer:CreatorOffer;canPublish:boolean}) {
  const [state,submit,pending]=useActionState(manageCreatorOffer,initialState);
  const expired=Date.parse(offer.reviewExpiresAt)<=Date.now();
  return <form action={submit} className="stack"><input type="hidden" name="version" value={offer.versionId}/>
    <p role="status">{creatorOfferStatus(offer)} · review expiry <time dateTime={offer.reviewExpiresAt}>{new Date(offer.reviewExpiresAt).toUTCString()}</time>. Publication requires a public profile, a current operator review and a freshly checked ready seller.</p>
    <div className="actions"><button className="button small" name="operation" value="publish" disabled={pending||!canPublish||expired}>Publish reviewed test version</button>
      <button className="button small" name="operation" value="withdraw" disabled={pending}>Withdraw test offer</button></div><ActionMessage state={state}/></form>;
}
