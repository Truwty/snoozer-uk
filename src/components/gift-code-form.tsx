"use client";

import { useActionState } from "react";
import { redeemGiftCode } from "@/app/studio/plan/gift";
import { initialState } from "@/lib/actions";
import { ActionMessage } from "./action-message";

export function GiftCodeForm() {
  const [state, submit, pending] = useActionState(redeemGiftCode, initialState);
  return <form className="stack" action={submit}>
    <label>Gift code<input name="code" maxLength={40} required type="password"
      autoComplete="off" autoCapitalize="none" spellCheck={false} /></label>
    <ActionMessage state={state} />
    <div><button className="button small" type="submit" disabled={pending}>Redeem gift code</button></div>
  </form>;
}
