"use client";
import { useActionState } from "react";
import { saveProductDraft } from "@/app/studio/products/actions";
import { initialState } from "@/lib/actions";
import { priceInput, type ProductDraft } from "@/lib/products";
import { ActionMessage } from "./action-message";

export function ProductDraftForm({ profileId, product, canActivate = true }: { profileId: string; product?: ProductDraft; canActivate?: boolean }) {
  const [state, submit, pending] = useActionState(saveProductDraft, initialState);
  return <form action={submit} className="stack">
    <input type="hidden" name="profile" value={profileId} /><input type="hidden" name="id" value={product?.id ?? ""} />
    <input type="hidden" name="revision" value={product?.revision ?? 0} />
    <label>Product title<input name="title" required minLength={1} maxLength={100} defaultValue={product?.title ?? ""} /></label>
    <label>Product description<textarea name="description" maxLength={2000} rows={4} defaultValue={product?.description ?? ""} /></label>
    <label>Price (GBP)<input name="price" type="text" inputMode="decimal" required pattern="(0|[1-9][0-9]{0,3})(\.[0-9]{1,2})?" defaultValue={product ? priceInput(product.amount) : ""} placeholder="5.00" /></label>
    <p className="muted">£0.50–£1,000.00. This saves a private draft; no payment is taken.</p>
    <div className="actions">
      <button className="button" name="archived" value={String(product?.archived ?? false)} disabled={pending}>{product ? "Save product draft" : "Create product draft"}</button>
      {product && <button className="button secondary" name="archived" value={String(!product.archived)} disabled={pending || (product.archived && !canActivate)}>{product.archived ? "Restore product draft" : "Archive product draft"}</button>}
    </div>
    <ActionMessage state={state} />
  </form>;
}
