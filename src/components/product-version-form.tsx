"use client";
import { useActionState } from "react";
import { manageProductVersion } from "@/app/studio/products/version-actions";
import { initialState } from "@/lib/actions";
import type { ProductFile } from "@/lib/product-files";
import type { ProductDraft } from "@/lib/products";
import type { ProductVersion } from "@/lib/product-versions";
import { ActionMessage } from "./action-message";

export function ProductVersionForm({ product, file, versions }: { product: ProductDraft; file?: ProductFile; versions: ProductVersion[] }) {
  const [state, submit, pending] = useActionState(manageProductVersion, initialState);
  return <section className="stack" style={{ overflowWrap: "anywhere" }} aria-label="Private product versions"><h3>Private versions</h3>
    <p>Freeze the saved title, description, price and PDF fingerprint together. Editing your draft keeps these snapshots unchanged. A fingerprint is not a malware scan; versions stay private and cannot be bought.</p>
    <p>{versions.length} of 5 private versions. Their shared PDF counts once towards storage and stays attached until all versions are discarded.</p>
    {versions.map((version) => <div className="panel stack" key={version.id}><h4>Revision {version.revision} · {version.title} · £{(version.amount / 100).toFixed(2)}</h4>
      <p>{version.description || "No description."}</p><p>{Math.ceil(version.bytes / 1024)} KB · SHA-256 <code style={{ overflowWrap: "anywhere" }}>{version.sha256}</code></p>
      <form action={submit}><input type="hidden" name="product" value={product.id} /><input type="hidden" name="id" value={version.id} /><input type="hidden" name="revision" value={version.revision} />
        <button className="button secondary" name="operation" value="discard" disabled={pending}>Discard private revision {version.revision}</button>
      </form>
    </div>)}
    {versions.length === 0 && <p>No frozen versions yet.</p>}
    {file?.state === "ready" && versions.length < 5 && !versions.some((version) => version.revision === product.revision && version.fileId === file.id) && <form action={submit}>
      <input type="hidden" name="product" value={product.id} /><input type="hidden" name="id" value={file.id} /><input type="hidden" name="revision" value={product.revision} />
      <button className="button" name="operation" value="freeze" disabled={pending}>Freeze saved private version</button>
    </form>}
    <ActionMessage state={state} />
  </section>;
}
