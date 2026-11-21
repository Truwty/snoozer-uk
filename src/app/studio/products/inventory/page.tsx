import Link from "next/link";
import {Brand} from "@/components/shell";
import {CreatorStockForm} from "@/components/creator-stock-form";
import {sellerStock,stockState} from "@/lib/creator-stock";
import {readStudioDraft,requireAccount,studioHref,type StudioProfileQuery} from "@/lib/profiles-server";

export const metadata={title:"Limited sandbox inventory",robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<StudioProfileQuery>}) {
  const {profile}=await searchParams;
  const draft=await readStudioDraft(profile);
  const {client}=await requireAccount();
  const response=draft?await client.rpc("list_my_creator_sandbox_stock",{p_profile:draft.profile_id}):null;
  const stock=sellerStock.safeParse(response?.data);
  return <main className="shell stack">
    <header className="nav"><Brand/><Link href={studioHref("/studio/products",draft?.profile_id)} className="button small">Back to Products</Link></header>
    <section className="panel stack">
      <p className="eyebrow">STUDIO / SANDBOX PRODUCTS</p><h1>Limited digital inventory</h1>
      <p>Set a cautious purchase-attempt limit for each immutable frozen PDF version, before its first Checkout attempt. Unlimited by default. Every accepted new reservation permanently uses a slot, including an abandoned Checkout. This cannot guarantee completed sales or grant buying permissions.</p>
      {!draft?<p>Claim a profile in Studio to manage frozen-version limits.</p>
      :response?.error||!stock.success?<p role="alert">Private inventory is unavailable. No limit was changed. Reload or contact support.</p>
      :<>
        {stock.data.length===0&&<p>No frozen product versions yet. Upload and freeze a private PDF in Products first.</p>}
        {stock.data.map(item=><section className="panel stack" key={item.versionId}>
          <h2>{item.title}</h2><p>Frozen revision {item.revision} · <code>{item.versionId}</code></p>
          <p role="status">{stockState(item)}</p>
          <CreatorStockForm profileId={draft.profile_id} versionId={item.versionId} totalSlots={item.totalSlots} reserved={item.reserved}/>
        </section>)}
      </>}
      <p className="muted">Only independently reviewed, unexpired test offers appear in the public store. Slot limits do not replace operator inspection, malware review, Stripe capability checks or signed payment verification. This feature never changes prior paid orders.</p>
    </section>
  </main>;
}
