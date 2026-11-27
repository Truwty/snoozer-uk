"use client";

import { useEffect,useState } from "react";
import { startImageHostLifetimeCheckout } from "@/app/studio/image-host/actions";

type Offer={price_id:string;currency:"eur";unit_amount:499};
type Props={offer:Offer|null;active:boolean};

const included=[
 "Add Custom Image Host Domain",
 "Public Domains",
 "Exclusive Badge",
 "Fast & Secure Uploads",
 "Advanced Image Gallery",
 "Create & Share Text Pastes",
 "Upload Analytics",
];

export function ImageHostPurchase({offer,active}:Props){
 const [open,setOpen]=useState(false);
 useEffect(()=>{
  if(!open)return;
  const previous=document.body.style.overflow;
  document.body.style.overflow="hidden";
  const onKeyDown=(event:KeyboardEvent)=>{
   if(event.key==="Escape")setOpen(false);
  };
  document.addEventListener("keydown",onKeyDown);
  return ()=>{
   document.body.style.overflow=previous;
   document.removeEventListener("keydown",onKeyDown);
  };
 },[open]);
 return <>
  <button type="button" className="button primary" onClick={()=>setOpen(true)}>
   {active?"Image Host Lifetime Access":"Purchase Image Host"}
  </button>
  {open&&<div className="studio-image-host-purchase-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)setOpen(false);}}>
   <section className="studio-image-host-purchase-dialog" role="dialog" aria-modal="true" aria-labelledby="studio-image-host-purchase-title">
    <button type="button" className="studio-profile-qr-close" aria-label="Close Image Host purchase" onClick={()=>setOpen(false)}>×</button>
    <p className="eyebrow">SNOOZER / IMAGE HOST</p>
    <h2 id="studio-image-host-purchase-title">Image Host</h2>
    <div className="studio-image-host-price">
     <strong>4,99€</strong><span>/ Lifetime</span>
    </div>
    <p className="studio-image-host-tagline">Pay once. Keep it forever.</p>
    <p className="studio-image-host-intro">Upload and share images instantly with custom domains and an advanced image gallery.</p>
    {active?<p className="message" role="status">Lifetime access is active on this Snoozer account.</p>:null}
    <ul className="studio-image-host-feature-list">
     {included.map(item=><li key={item}><span aria-hidden="true">✓</span><span>{item}</span></li>)}
    </ul>
    {active
      ?<p className="studio-image-host-active-note">This account already has permanent Image Host access.</p>
      :offer
       ?<form action={startImageHostLifetimeCheckout}>
         <input type="hidden" name="price" value={offer.price_id}/>
         <div className="studio-image-host-checkout-actions">
          <button type="submit" className="button primary studio-image-host-purchase-button">Purchase</button>
          <button type="button" className="studio-image-host-gift-button" disabled aria-label="Gift Image Host is not available yet" title="Image Host gifting is not configured yet">♔</button>
         </div>
        </form>
       :<div className="studio-image-host-checkout-locked" role="status">
         <strong>Checkout is not available yet</strong>
         <p>The lifetime offer is waiting for Stripe product, tax and legal review. No payment can be started from this screen yet.</p>
        </div>}
    <p className="studio-image-host-small-print">One-time payment. Access is activated only after Snoozer verifies the completed live Stripe payment.</p>
   </section>
  </div>}
 </>;
}
