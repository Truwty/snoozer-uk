"use client";
import { useActionState } from "react";
import { manageProductFile } from "@/app/studio/products/file-actions";
import { initialState } from "@/lib/actions";
import type { ProductFile } from "@/lib/product-files";
import { ActionMessage } from "./action-message";

export function ProductFileForm({ profileId, productId, file }: { profileId: string; productId: string; file?: ProductFile }) {
  const [state, submit, pending] = useActionState(manageProductFile, initialState);
  return <section className="stack" aria-label="Private product file"><h3>Private PDF source</h3>
    <p className="muted">One PDF up to 4 MB. Files and pending reservations count towards your account’s media storage. Files are not malware-scanned and are served as attachments, never inline. No buyer access is enabled.</p>
    {file && <p>File: {Math.ceil(file.bytes / 1024)} KB · {file.state === "ready" ? "Private attachment" : file.state === "pending" ? "Pending upload — finish or remove it" : "Removal pending — retry removal"}</p>}
    {file?.state === "ready" && <a className="text-link" href={`/studio/products/file/${file.id}`} download>Download private PDF</a>}
    <form action={submit} className="stack">
      <input type="hidden" name="profile" value={profileId} /><input type="hidden" name="product" value={productId} /><input type="hidden" name="fileId" value={file?.id ?? ""} />
      {!file && <label>PDF file<input name="file" type="file" accept="application/pdf,.pdf" required /></label>}
      <div className="actions">
        {!file && <button className="button" name="operation" value="upload" disabled={pending}>Upload private PDF</button>}
        {file?.state === "pending" && <button className="button" name="operation" value="finish" disabled={pending}>Finish pending PDF</button>}
        {file && <button className="button secondary" name="operation" value="remove" disabled={pending}>Remove private PDF</button>}
      </div><ActionMessage state={state} />
    </form>
  </section>;
}
