"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/actions";
import { initialState } from "@/lib/actions";
import { changeEmail } from "@/app/studio/account/actions";
import { ActionMessage } from "./action-message";

export function EmailChangeForm(){
 const [state,submit,pending]=useActionState(changeEmail,initialState as ActionState);
 return <form action={submit} className="stack">
  <label htmlFor="new-account-email">New email address</label>
  <input id="new-account-email" name="email" type="email" autoComplete="email" maxLength={254} required placeholder="name@example.com"/>
  <p className="muted">Snoozer uses Supabase secure email-change confirmation. Depending on the Auth security setting, you may need to confirm from both your current and new inboxes. Your current address remains active until the change is completed.</p>
  <button className="button small" type="submit" disabled={pending}>{pending?"Sending…":"Send confirmation"}</button>
  <ActionMessage state={state}/>
 </form>;
}
