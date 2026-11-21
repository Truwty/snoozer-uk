import Link from "next/link";
import { Brand } from "@/components/shell";
import { CreatorCollectionForm } from "@/components/creator-collection-form";
import { creatorCollections } from "@/lib/creator-collections";
import { productInventory } from "@/lib/products";
import { readStudioDraft, requireAccount, studioHref, type StudioProfileQuery } from "@/lib/profiles-server";

export const metadata={title:"Creator collections",robots:{index:false,follow:false}};

export default async function Page({searchParams}:{searchParams:Promise<StudioProfileQuery>}) {
  const {profile}=await searchParams;
  const draft=await readStudioDraft(profile);
  const {client}=await requireAccount();
  const collectionsResponse=draft?await client.rpc("list_my_creator_collections",{p_profile:draft.profile_id}):null;
  const collectionItems=creatorCollections.safeParse(collectionsResponse?.data);
  const productsResponse=draft?await client.rpc("list_my_product_drafts",{p_profile:draft.profile_id}):null;
  const products=productInventory.safeParse(productsResponse?.data);
  return <main className="shell stack">
    <header className="nav"><Brand/><Link href={studioHref("/studio/products",draft?.profile_id)} className="button small">Back to Products</Link></header>
    <section className="panel stack">
      <p className="eyebrow">STUDIO / PRODUCTS</p><h1>Creator collections</h1>
      <p>Organise up to five groups of product drafts per profile, with up to five products each. Groups are private by default. Public sandbox collections show only products independently reviewed and currently available through the existing test-store gate.</p>
      {!draft?<p>Claim a profile in Studio before organising products.</p>
        :collectionsResponse?.error||productsResponse?.error||!collectionItems.success||!products.success
        ?<p role="alert">Your private collections are unavailable. No changes were made. Reload to try again.</p>
        :<>
          {collectionItems.data.length===0&&<p>No collections yet. Create one below to group existing drafts.</p>}
          {collectionItems.data.map(collection=><details className="panel stack" key={collection.id}>
            <summary>{collection.title} · {collection.visible?"Public when eligible":"Private"} · {collection.productIds.length} products</summary>
            <CreatorCollectionForm key={collection.revision} collection={collection} profileId={draft.profile_id} products={products.data.items}/>
          </details>)}
          {collectionItems.data.length<5
            ?<section className="panel stack" aria-label="New collection"><h2>New collection</h2>
              <CreatorCollectionForm profileId={draft.profile_id} products={products.data.items}/>
            </section>
            :<p role="status">Five collection limit reached. Remove one before creating another.</p>}
          <p className="muted">An empty or non-eligible public group never appears in the store. Deleting a collection does not delete products, PDF files, reviews or buyers' purchases.</p>
        </>}
    </section>
  </main>;
}
