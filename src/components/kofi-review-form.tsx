"use client";

import { useActionState } from "react";
import { requestKofiReview } from "@/app/studio/plan/kofi-review";
import { initialState } from "@/lib/actions";
import { ActionMessage } from "./action-message";

export function KofiReviewForm() {
  const [state, submit, pending] = useActionState(requestKofiReview, initialState);
  return <form className="stack" action={submit}>
    <label>Ko-fi transaction reference<input name="reference" maxLength={128} required
      autoComplete="off" autoCapitalize="none" spellCheck={false} /></label>
    <ActionMessage state={state} />
    <div><button className="button small" type="submit" disabled={pending}>Request donation review</button></div>
  </form>;
}
