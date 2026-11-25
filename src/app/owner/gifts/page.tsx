import { z } from "zod";
import { requireOwner } from "@/lib/owner/auth";
import { OwnerGiftCreator } from "@/components/owner-gift-creator";
import { revokeOwnerGiftLink } from "./actions";

export const metadata={title:"Owner · Gift links",robots:{index:false,follow:false}};
const gifts=z.array(z.object({
 id:z.uuid(),plan:z.string(),plan_version:z.number().int(),duration_days:z.number().int(),
 created_at:z.string(),expires_at:z.string(),claimed_at:z.string().nullable(),claimed_by:z.string().nullable(),
 revoked_at:z.string().nullable(),reason:z.string(),status:z.enum(["ready","claimed","expired","revoked"]),
}));
export default async function OwnerGifts({searchParams}:{searchParams:Promise<{status?:string}>}){
 const status=(await searchParams).status;
 const {client}=await requireOwner();
 const response=await client.rpc("owner_list_gift_links");
 const parsed=gifts.safeParse(response.data);
 return <main className="stack owner-gifts-page">
  <header className="stack"><p className="eyebrow">OWNER / PREMIUM REWARDS</p><h1>One-time gift links</h1>
   <p className="muted">Create an audited Plus, Pro or Studio gift link. Each link can be claimed once by a verified Snoozer account. The token is hashed at rest and shown once at creation.</p></header>
  {status==="revoked"&&<p role="status">Gift link revoked.</p>}
  {status==="denied"&&<p role="alert">Gift link could not be revoked. Complete Owner MFA and ensure it has not been claimed.</p>}
  {status==="invalid"&&<p role="alert">Enter a valid gift and reason.</p>}
  <section className="panel stack"><h2>Create a gift</h2><p className="muted">Limit: 25 gift links per Owner per day. Premium plan versions are pinned to the active v1 catalogue.</p><OwnerGiftCreator/></section>
  <section className="panel stack"><h2>Issued gift links</h2>
   {!parsed.success?<p role="alert">Gift history is unavailable.</p>:parsed.data.length===0?<p>No Owner gift links have been issued yet.</p>:<div className="owner-gift-list">
    {parsed.data.map(gift=><article className="owner-gift-row" key={gift.id}>
     <div><strong>{gift.plan.toUpperCase()} · {gift.duration_days} days</strong>
      <p className="muted">{gift.status.toUpperCase()} · Created {new Date(gift.created_at).toLocaleString("en-GB")}</p>
      <p className="muted">Expires {new Date(gift.expires_at).toLocaleString("en-GB")}{gift.claimed_at?" · Claimed "+new Date(gift.claimed_at).toLocaleString("en-GB"):""}</p>
      {gift.claimed_by&&<p className="muted">Recipient UID: <code>{gift.claimed_by}</code></p>}
      <p className="muted">Reason: {gift.reason}</p>
     </div>
     {gift.status==="ready"&&<form action={revokeOwnerGiftLink} className="stack">
      <input type="hidden" name="gift" value={gift.id}/>
      <label>Revocation reason<input name="reason" minLength={8} maxLength={500} required/></label>
      <button className="button small danger" type="submit">Revoke link</button>
     </form>}
    </article>)}
   </div>}
  </section>
 </main>;
}
