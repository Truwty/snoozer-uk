import Link from "next/link";
import { Brand } from "@/components/shell";
import { CreatorDiscountForm,DisableCreatorDiscountForm } from "@/components/creator-discount-form";
import { sellerDiscounts } from "@/lib/creator-discounts";
import { readStudioDraft,requireAccount,studioHref,type StudioProfileQuery } from "@/lib/profiles-server";

export const metadata={title:"Sandbox discount codes",robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<StudioProfileQuery>}) {
  const {profile}=await searchParams;
  const draft=await readStudioDraft(profile);
  const {client}=await requireAccount();
  const response=draft?await client.rpc("list_my_creator_discounts",{p_profile:draft.profile_id}):null;
  const discounts=sellerDiscounts.safeParse(response?.data);
  return <main className="shell stack"><header className="nav"><Brand/><Link href={studioHref("/studio/products",draft?.profile_id)} className="button small">Back to Products</Link></header>
    <section className="panel stack"><p className="eyebrow">STUDIO / SANDBOX PRODUCTS</p><h1>Discount codes</h1>
      <p>Create bounded percentage discounts for exact frozen PDF versions. Final amounts are rounded down to whole pence and must be at least £0.50. Codes are case-insensitive and cannot be stacked. Share codes privately.</p>
      <p>Every new discounted Checkout reservation permanently consumes one redemption, even if abandoned, refunded or expired. A retry keeps the original reserved price. These codes do not enable live sales.</p>
      {!draft?<p>Claim a profile first.</p>:response?.error||!discounts.success?<p role="alert">Private discounts are unavailable. Reload before making changes.</p>:<>
        {discounts.data.versions.length?<CreatorDiscountForm profileId={draft.profile_id} versions={discounts.data.versions}/>:<p>Freeze a private PDF version in Products first.</p>}
        <h2>Existing codes</h2>{discounts.data.codes.length===0&&<p>No discount codes yet.</p>}
        {discounts.data.codes.map(c=><section className="panel stack" key={c.id}><h3><code>{c.code}</code> · {c.percentOff}% off</h3>
          <p>{c.title} · version <code>{c.versionId}</code></p><p>{c.used} of {c.maxUses} reservations used · expires {c.expiresAt}</p>
          <p>{c.disabled?"Disabled":c.used>=c.maxUses?"Exhausted":"Enabled until expiry"}</p>
          {!c.disabled&&<DisableCreatorDiscountForm profileId={draft.profile_id} id={c.id}/>}</section>)}
      </>}
    </section></main>;
}
