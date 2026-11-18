import Link from "next/link";
import { Brand } from "@/components/shell";
import { ProductDraftForm } from "@/components/product-draft-form";
import { ProductFileForm } from "@/components/product-file-form";
import { productFile } from "@/lib/product-files";
import { z } from "zod";
import { productInventory } from "@/lib/products";
import { readStudioDraft, requireAccount, studioHref, type StudioProfileQuery } from "@/lib/profiles-server";

export const metadata = { title: "Product drafts", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<StudioProfileQuery> }) {
  const { profile } = await searchParams;
  const draft = await readStudioDraft(profile);
  const { client } = await requireAccount();
  const response = draft ? await client.rpc("list_my_product_drafts", { p_profile: draft.profile_id }) : null;
  const inventory = productInventory.safeParse(response?.data);
  const fileResponse = draft ? await client.rpc("list_my_product_files", { p_profile: draft.profile_id }) : null;
  const files = z.array(productFile).max(20).safeParse(fileResponse?.data);
  return <main className="shell stack">
    <header className="nav"><Brand /><Link className="button small" href={studioHref("/studio", profile === undefined ? undefined : draft?.profile_id)}>Back to Studio</Link></header>
    <section className="panel stack"><p className="eyebrow">STUDIO / PRODUCTS</p><h1>Product drafts</h1>
      <p>Prepare your digital product catalogue privately. Products, files, checkout and buyer delivery must all be ready before a storefront can open. These drafts are not published or available to buy.</p>
      <Link href="/studio/products/seller">Stripe sandbox seller setup</Link>
      {!draft ? <p>Claim a profile in Studio before creating products.</p> : !inventory.success || response?.error ? <p role="alert">Your product catalogue is unavailable. Reload to try again.</p> : <>
        <p>{inventory.data.activeUsed} of {inventory.data.activeLimit} active drafts · {inventory.data.totalUsed} of {inventory.data.totalLimit} total across your account. Archived products retain their details.</p>
        {inventory.data.items.length === 0 && <p>No product drafts for this profile yet.</p>}
        {inventory.data.items.map((product) => <details className="panel stack" key={product.id}>
          <summary><h2 className="product-summary-title">{product.title} · {product.archived ? "Archived" : "Private draft"}</h2></summary>
          <ProductDraftForm key={product.revision} profileId={draft.profile_id} product={product} canActivate={inventory.data.activeUsed < inventory.data.activeLimit} />
          {files.success && !fileResponse?.error ? <ProductFileForm key={files.data.find((file) => file.productId === product.id)?.state ?? "empty"} profileId={draft.profile_id} productId={product.id} file={files.data.find((file) => file.productId === product.id)} /> : <p role="alert">Private files are unavailable. Reload to try again.</p>}
        </details>)}
        {inventory.data.activeUsed < inventory.data.activeLimit && inventory.data.totalUsed < inventory.data.totalLimit
          ? <section className="stack" aria-labelledby="new-product-title"><h2 id="new-product-title">New product</h2><ProductDraftForm profileId={draft.profile_id} /></section>
          : <p role="status">Catalogue limit reached. Archive an active draft to free an active slot. Up to twenty total drafts are retained.</p>}
      </>}
    </section>
  </main>;
}
