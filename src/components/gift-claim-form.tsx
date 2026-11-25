"use client";

import { useEffect, useState, useActionState } from "react";
import Link from "next/link";
import { initialState } from "@/lib/actions";
import { claimGiftLink } from "@/app/studio/account/actions";
import { ActionMessage } from "./action-message";

export function GiftClaimForm(){
 const [token,setToken]=useState("");
 const [state,submit,pending]=useActionState(claimGiftLink,initialState);
 useEffect(()=>{
  let value="";
  try{
   value=window.location.hash.slice(1);
   if(!/^[a-f0-9]{32}$/i.test(value))value=sessionStorage.getItem("snoozer-gift-token")??"";
   if(/^[a-f0-9]{32}$/i.test(value)){
    sessionStorage.setItem("snoozer-gift-token",value);
    setToken(value.toLowerCase());
    if(window.location.hash)history.replaceState(null,"",window.location.pathname+window.location.search);
   }
  }catch{/* Private browsing can block storage; the hash is still captured above when available. */}
 },[]);
 return <div className="panel stack">
  {token
   ? <form action={submit} className="stack">
      <input type="hidden" name="token" value={token}/>
      <p>Your gift link is ready. Claim it once while signed in to add the Premium time to your account.</p>
      <button className="button primary" disabled={pending}>{pending?"Claiming…":"Claim gift"}</button>
     </form>
   : <p>Open the original gift link on this device. The private claim token is kept in this browser and removed from the address bar.</p>}
  {!token&&<p><Link className="button" href="/sign-in?next=%2Fgift">Sign in to continue</Link></p>}
  <ActionMessage state={state}/>
  {state.status==="success"&&<p><Link href="/studio/plan">View your plan and usage ↗</Link></p>}
 </div>;
}
