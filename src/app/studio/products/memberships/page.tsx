import Link from "next/link";
import {Brand} from "@/components/shell";
import {CreatorMembershipForm} from "@/components/creator-membership-form";
import {ownerMembershipOffers} from "@/lib/creator-membership";
import {readStudioDraft,requireAccount,studioHref,type StudioProfileQuery} from "@/lib/profiles-server";

export const metadata={title:"Creator membership proposals",robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<StudioProfileQuery>}) {
  const {profile}=await searchParams;
  const draft=await readStudioDraft(profile);
  const {client}=await requireAccount();
  const response=draft?await client.rpc("list_my_creator_membership_offers",{p_profile:draft.profile_id}):null;
  const offers=ownerMembershipOffers.safeParse(response?.data);
  return <main className="shell stack"><header className="nav"><Brand/><Link href={studioHref("/studio/products",draft?.profile_id)} className="button small">Back to Products</Link></header>
    <section className="panel stack"><p className="eyebrow">STUDIO / SANDBOX PRODUCTS</p><h1>Creator membership proposals</h1>
      <p>Plan up to five monthly membership tiers. These are non-purchasable previews only. No subscribers, recurring charges, member access or Snoozer Plus benefits are created.</p>
      {!draft?<p>Claim a profile in Studio first.</p>:response?.error||!offers.success?<p role="alert">Membership proposals are unavailable. Reload before trying again.</p>:<>
        {offers.data.map(item=><CreatorMembershipForm key={item.id+":"+item.revision} profileId={draft.profile_id} item={item}/>)}
        {offers.data.length<5&&<CreatorMembershipForm key={"new:"+offers.data.length} profileId={draft.profile_id}/>}
      </>}
    </section></main>;
}
