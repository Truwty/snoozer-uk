import Link from "next/link";
import { buildCreatorQaPdf, qaPdfSha256 } from "../../../../scripts/creator-commerce-qa-fixture.mjs";
import { Brand } from "@/components/shell";
import { ProductDraftForm } from "@/components/product-draft-form";
import { ProductFileForm } from "@/components/product-file-form";
import { ProductVersionForm } from "@/components/product-version-form";
import { CreatorOfferForm } from "@/components/creator-offer-form";
import { creatorCheckoutConfig } from "@/lib/creator-checkout";
import { creatorOffers } from "@/lib/creator-store";
import { productVersions } from "@/lib/product-versions";
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
  const versionResponse = draft ? await client.rpc("list_my_product_versions", { p_profile: draft.profile_id }) : null;
  const versions = productVersions.safeParse(versionResponse?.data);
  const offerResponse=draft?await client.rpc("list_my_creator_sandbox_offers",{p_profile:draft.profile_id}):null;
  const offers=creatorOffers.safeParse(offerResponse?.data);
  const checkoutEnabled=!!creatorCheckoutConfig();
  const qaBytes = buildCreatorQaPdf();
  const qaReferenceSha = qaPdfSha256(qaBytes);
  return <main className="shell stack">
    <header className="nav"><Brand /><Link className="button small" href={studioHref("/studio", profile === undefined ? undefined : draft?.profile_id)}>Back to Studio</Link></header>
    <section className="panel stack"><p className="eyebrow">STUDIO / PRODUCTS</p><h1>Product drafts</h1>
      <p>Prepare your digital product catalogue privately. Freezing a version does not publish it. Only separately reviewed test fixtures can be enabled for sandbox purchases; live selling is unavailable.</p>
      <Link href="/studio/products/seller">Stripe sandbox seller setup</Link>
      {checkoutEnabled&&draft&&<Link href={`/store/${draft.username}`}>View sandbox store</Link>}
      {draft && <section className="panel stack" aria-labelledby="isolated-qa-setup">
        <h2 id="isolated-qa-setup">Prepare a separate sandbox QA product</h2>
        <p>This setup uses a synthetic test PDF and a private draft. It does not create a payment, publish a product or approve content for buyers.</p>
        <div className="actions">
          <a className="button secondary" href="/studio/products/qa-fixture" download="snoozer-isolated-sandbox-qa.pdf">Download test PDF</a>
        </div>
        <p className="muted">Reference downloaded fixture: {qaBytes.length} bytes · SHA-256 <code style={{ overflowWrap: "anywhere" }}>{qaReferenceSha}</code>. Calculate the SHA-256 of the <strong>actual frozen upload</strong> independently before operator approval. This reference alone does not approve an offer.</p>
        <p>Next: select <strong>Fill sandbox QA draft</strong> under New product, save it, upload this exact PDF and freeze a private version. Then a trusted operator must inspect the frozen PDF and review its SHA-256 before you can publish a short-lived test offer.</p>
        <p className="muted">Use a new product and a separate verified buyer. Never reuse the existing paid £5 order. Test-mode payments and refunds are not triggered by this setup.</p>
      </section>}
      {!draft ? <p>Claim a profile in Studio before creating products.</p> : !inventory.success || response?.error ? <p role="alert">Your product catalogue is unavailable. Reload to try again.</p> : <>
        <p>{inventory.data.activeUsed} of {inventory.data.activeLimit} active drafts · {inventory.data.totalUsed} of {inventory.data.totalLimit} total across your account. Archived products retain their details.</p>
        {inventory.data.items.length === 0 && <p>No product drafts for this profile yet.</p>}
        {inventory.data.items.map((product) => <details className="panel stack" key={product.id}>
          <summary><h2 className="product-summary-title">{product.title} · {product.archived ? "Archived" : "Private draft"}</h2></summary>
          <ProductDraftForm key={product.revision} profileId={draft.profile_id} product={product} canActivate={inventory.data.activeUsed < inventory.data.activeLimit} />
          {files.success && !fileResponse?.error ? <ProductFileForm key={files.data.find((file) => file.productId === product.id)?.state ?? "empty"} profileId={draft.profile_id} productId={product.id} file={files.data.find((file) => file.productId === product.id)} /> : <p role="alert">Private files are unavailable. Reload to try again.</p>}
          {versions.success && !versionResponse?.error && files.success && !fileResponse?.error ? <ProductVersionForm product={product} file={files.data.find((file) => file.productId === product.id)} versions={versions.data.filter((version) => version.productId === product.id)} /> : <p role="alert">Private versions are unavailable. Reload to try again.</p>}
          <section className="stack" aria-label="Sandbox test offers"><h3>Sandbox test offers</h3>
            {!checkoutEnabled&&<p>New test purchases are disabled. Existing offers can still be withdrawn.</p>}
            {offers.success&&!offerResponse?.error?offers.data.filter(offer=>versions.success&&versions.data.some(v=>v.id===offer.versionId&&v.productId===product.id)).map(offer=><CreatorOfferForm key={offer.versionId} offer={offer} canPublish={checkoutEnabled}/>):<p role="alert">Test offers are unavailable. Reload to try again.</p>}
            <p>A trusted operator must inspect the exact sandbox PDF and review its frozen fingerprint before it can be published. Review lasts 24 hours. This does not clear production content for sale.</p>
          </section>
        </details>)}
        {inventory.data.activeUsed < inventory.data.activeLimit && inventory.data.totalUsed < inventory.data.totalLimit
          ? <section className="stack" aria-labelledby="new-product-title"><h2 id="new-product-title">New product</h2><ProductDraftForm profileId={draft.profile_id} /></section>
          : <p role="status">Catalogue limit reached. Archive an active draft to free an active slot. Up to twenty total drafts are retained.</p>}
      </>}
    </section>
  </main>;
}
