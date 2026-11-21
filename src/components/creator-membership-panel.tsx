import {MembershipCheckout} from "./creator-membership-checkout";
import {publicMembershipOffers} from "@/lib/creator-membership";
export function CreatorMembershipPanel({offers,checkoutOffers=[],name=""}:{offers:unknown;checkoutOffers?:string[];name?:string}) {
  const parsed=publicMembershipOffers.safeParse(offers);
  if(!parsed.success||parsed.data.length===0) return null;
  return <section className="stack" aria-label="Membership proposals"><h2>Proposed memberships</h2>
    {checkoutOffers.length>0?<p>Only individually reviewed tiers may open recurring test Checkout. No real payments or Snoozer Plus access.</p>:<p>Preview only. Memberships are not available for purchase, and no recurring charges or member access are enabled.</p>}
    {parsed.data.map(item=><article key={item.id} className="panel stack">
      <h3>{item.title}</h3><p>Proposed price: £{(item.monthlyPence/100).toFixed(2)} GBP / month</p>
      <p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{item.benefits}</p>
      {checkoutOffers.includes(item.id)&&name&&<MembershipCheckout offer={item.id} name={name}/>}
    </article>)}
  </section>;
}
