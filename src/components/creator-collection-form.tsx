"use client";
import { useActionState } from "react";
import { saveCreatorCollection } from "@/app/studio/products/collections/actions";
import { initialState } from "@/lib/actions";
import type { CreatorCollection } from "@/lib/creator-collections";
import type { ProductDraft } from "@/lib/products";
import { ActionMessage } from "./action-message";

export function CreatorCollectionForm({
  profileId,collection,products,
}: {profileId:string;collection?:CreatorCollection;products:ProductDraft[]}) {
  const [state,submit,pending]=useActionState(saveCreatorCollection,initialState);
  return <form action={submit} className="stack">
    <input type="hidden" name="profile" value={profileId}/>
    <input type="hidden" name="id" value={collection?.id??""}/>
    <input type="hidden" name="revision" value={collection?.revision??0}/>
    <label>Collection name<input name="title" defaultValue={collection?.title??""} required maxLength={80} minLength={1} disabled={pending}/></label>
    <label>Collection description<textarea name="description" defaultValue={collection?.description??""} maxLength={500} rows={3} disabled={pending}/></label>
    <fieldset className="stack">
      <legend>Include up to five drafts from this profile</legend>
      {products.length===0?<p>No product drafts yet. Create a draft in Products first.</p>
        :products.map(product=><label key={product.id}>
          <input type="checkbox" name="products" value={product.id}
            defaultChecked={collection?.productIds.includes(product.id)??false} disabled={pending}/>
          {" "}{product.title}{product.archived?" (archived)":""}
        </label>)}
    </fieldset>
    <label><input name="visible" type="checkbox" defaultChecked={collection?.visible??false} disabled={pending}/> Show this collection in the sandbox store when at least one included product has a currently valid reviewed offer</label>
    <p className="muted">Collections organise drafts only. This cannot approve a PDF, change frozen files, sell a product, extend an offer, bypass Stripe or grant download access.</p>
    <div className="actions">
      <button className="button" name="intent" value="save" disabled={pending}>{collection?"Save collection":"Create collection"}</button>
      {collection&&<button className="button secondary" name="intent" value="delete" disabled={pending}>Delete collection</button>}
    </div>
    <ActionMessage state={state}/>
  </form>;
}
