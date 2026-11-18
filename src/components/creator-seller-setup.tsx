"use client";
import { useActionState } from "react";
import { manageCreatorSandbox } from "@/app/studio/products/seller/actions";
import { initialState } from "@/lib/actions";
import { ActionMessage } from "./action-message";

export function CreatorSellerSetup({ enabled, bound }: { enabled: boolean; bound: boolean }) {
  const [state, submit, pending] = useActionState(manageCreatorSandbox, initialState);
  return <div className="stack">
    <form action={submit} className="stack">
      <label>Sandbox country<select name="country" disabled={!enabled || pending}><option value="GB">United Kingdom — testing only</option></select></label>
      <label className="check"><input name="acknowledge" type="checkbox" required disabled={!enabled || pending} />I understand this creates or resumes a Stripe sandbox seller account. Stripe collects onboarding details directly. This does not enable live selling or payouts.</label>
      <p className="muted">Setup creates a persistent provider binding. Account deletion requires operator reconciliation of this binding. No bank, identity document or agreement is filled in by Snoozer.</p>
      <div><button className="button" name="operation" value="onboard" disabled={!enabled || pending}>{bound ? "Resume Stripe sandbox setup" : "Start Stripe sandbox setup"}</button></div>
    </form>
    {bound && <form action={submit}><button className="button secondary" name="operation" value="refresh" disabled={!enabled || pending}>Check sandbox account status</button></form>}
    <ActionMessage state={state} />
  </div>;
}
