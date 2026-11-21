import Link from "next/link";
import { Brand } from "@/components/shell";
import { CreatorAffiliateDisclosureForm } from "@/components/creator-affiliate-disclosure-form";
import { creatorAffiliateDisclosure } from "@/lib/creator-affiliate-disclosure";
import { readStudioDraft, requireAccount, studioHref, type StudioProfileQuery } from "@/lib/profiles-server";

export const metadata={title:"Store affiliate disclosure",robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<StudioProfileQuery>}) {
  const {profile}=await searchParams;
  const draft=await readStudioDraft(profile);
  const {client}=await requireAccount();
  const response=draft?await client.rpc("get_my_creator_affiliate_disclosure",{p_profile:draft.profile_id}):null;
  const settings=creatorAffiliateDisclosure.safeParse(response?.data);
  return <main className="shell stack">
    <header className="nav"><Brand/><Link href={studioHref("/studio/products",draft?.profile_id)} className="button small">Back to Products</Link></header>
    <section className="panel stack">
      <p className="eyebrow">STUDIO / PRODUCTS</p><h1>Affiliate disclosure</h1>
      <p>Disclose affiliate commissions, promotional partnerships or sponsorships accurately. This information belongs to the profile you currently manage and will only appear on an eligible sandbox storefront when explicitly enabled.</p>
      {!draft?<p>Claim a profile in Studio to configure a disclosure.</p>
        :response?.error||!settings.success?<p role="alert">Your disclosure settings are unavailable. No changes were made. Reload later.</p>
        :<CreatorAffiliateDisclosureForm key={settings.data.revision} profileId={draft.profile_id} settings={settings.data}/>}
    </section>
  </main>;
}
