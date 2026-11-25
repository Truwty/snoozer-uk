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
  let value=window.location.hash.slice(1);
  if(!/^[a-f0-9]{32}$/i.test(value)){
   try{value=sessionStorage.getItem("snoozer-gift-token")??"";}catch{/* Storage is optional. */}
  }
  if(/^[a-f0-9]{32}$/i.test(value)){
   setToken(value.toLowerCase());
   try{
    sessionStorage.setItem("snoozer-gift-token",value.toLowerCase());
    if(window.location.hash)history.replaceState(null,"",window.location.pathname+window.location.search);
   }catch{/* Leave the hash in place if storage is unavailable so sign-in can return to it. */}
  }
 },[]);
 useEffect(()=>{
  if(state.status==="success"){
   try{sessionStorage.removeItem("snoozer-gift-token");}catch{/* No persistent token to clear. */}
   setToken("");
  }
 },[state.status]);
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
