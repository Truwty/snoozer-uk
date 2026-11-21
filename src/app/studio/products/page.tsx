import Link from "next/link";
import { buildCreatorQaPdf, qaPdfSha256 } from "../../../../scripts/creator-commerce-qa-fixture.mjs";
import { Brand } from "@/components/shell";
import { ProductDraftForm } from "@/components/product-draft-form";
import { ProductFileForm } from "@/components/product-file-form";
import { ProductVersionForm } from "@/components/product-version-form";
import { CreatorOfferForm } from "@/components/creator-offer-form";
import { creatorCheckoutConfig } from "@/lib/creator-checkout";
import { creatorOffers } from "@/lib/creator-store";
import { productVersions, type ProductVersion } from "@/lib/product-versions";
import { creatorQaDraft } from "@/lib/creator-qa-studio";
import { inspectCreatorQaFrozenVersion } from "@/lib/creator-qa-frozen-preflight";
import { productFile } from "@/lib/product-files";
import { z } from "zod";
import { productInventory } from "@/lib/products";
import { readStudioDraft, requireAccount, studioHref, type StudioProfileQuery } from "@/lib/profiles-server";

export const metadata = { title: "Product drafts", robots: { index: false, follow: false } };

// Private owner-only display: metadata parity is NOT a provider review, file scan,
// independent byte inspection or authorization to publish a product.
function QaFrozenVersionCheck({ version, reference }: {
  version: ProductVersion;
  reference: { bytes: number; sha256: string };
}) {
  const result = inspectCreatorQaFrozenVersion(version, reference);
  return <div className="panel stack" style={{overflowWrap:"anywhere"}}>
    <h4>Frozen QA revision {version.revision}</h4>
    <p>Frozen version UUID for operator inspection: <code>{version.id}</code></p>
    <p role="status">{result.matchesReferenceMetadata
      ? "Frozen version metadata matches the synthetic QA reference."
      : "Frozen version metadata does not match the synthetic QA reference. Do not submit this version for review."}</p>
    {!result.matchesReferenceMetadata && <ul>{result.mismatches.map(issue=><li key={issue}>{issue}</li>)}</ul>}
    <p><a href={`/studio/products/version/${version.id}`} download>Download this exact private revision for independent inspection</a></p>
    <p className="muted">This is only a comparison of stored frozen title, price, byte count and SHA-256. A trusted operator must independently inspect and hash the downloaded frozen bytes, run the existing read-only database preflight, then explicitly approve the version. A matching display never grants approval or publication.</p>
  </div>;
}

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
      <p className="muted">Creator tips: to show an external Ko-fi support link on your sandbox store, add your own HTTPS Ko-fi profile address in your ordinary Studio profile links and publish the profile. The panel does not take Snoozer payments or unlock products.</p>
      <Link href="/studio/products/seller">Stripe sandbox seller setup</Link>
      {draft&&<Link href={studioHref("/studio/products/inventory",draft.profile_id)}>Manage limited digital inventory</Link>}
      {draft&&<Link href={studioHref("/studio/products/discounts",draft.profile_id)}>Manage sandbox discount codes</Link>}
      {draft&&<Link href={studioHref("/studio/products/disclosure",draft.profile_id)}>Manage affiliate disclosure</Link>}
      {draft&&<Link href={studioHref("/studio/products/collections",draft.profile_id)}>Manage creator collections</Link>}
      {draft && <Link href={studioHref("/studio/products/analytics",draft.profile_id)}>View private sandbox storefront analytics</Link>}
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
          {versions.success && !versionResponse?.error && (product.title === creatorQaDraft.title || versions.data.some(version=>version.productId===product.id && version.title===creatorQaDraft.title)) &&
            <section className="stack" aria-label="Isolated sandbox QA frozen version preflight">
              <h3>Isolated QA frozen-version preflight</h3>
              <p>Use a new version without any existing purchase. Metadata mismatch must be corrected by creating a separate private revision, not editing previously purchased bytes.</p>
              {versions.data.filter(version=>version.productId===product.id).length === 0
                ? <p>No frozen QA version yet. Upload the synthetic PDF and freeze a version above.</p>
                : versions.data.filter(version=>version.productId===product.id).map(version=>
                  <QaFrozenVersionCheck key={version.id} version={version} reference={{bytes:qaBytes.length,sha256:qaReferenceSha}} />)}
            </section>}
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
