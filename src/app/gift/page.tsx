import Link from "next/link";
import { GiftClaimForm } from "@/components/gift-claim-form";

export const metadata={title:"Claim a Snoozer gift",description:"Claim a one-time Snoozer Premium gift link.",robots:{index:false,follow:false}};
export default function GiftPage(){
 return <main className="shell stack">
  <header className="stack" style={{maxWidth:"42rem",margin:"3rem auto 1rem"}}>
   <p className="eyebrow">SNOOZER / GIFT</p><h1>You've got a gift.</h1>
   <p className="muted">A one-time Premium gift link can add Plus, Pro or Studio time to a verified Snoozer account. Each link can only be claimed once before it expires.</p>
  </header>
  <div style={{maxWidth:"42rem",margin:"0 auto",width:"100%"}}><GiftClaimForm/></div>
  <p className="muted" style={{textAlign:"center"}}><Link href="/">Back to Snoozer</Link></p>
 </main>;
}
