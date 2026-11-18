"use client";
import { useActionState } from "react";
import { changeGrowth } from "@/app/studio/growth/actions";
import { initialState } from "@/lib/actions";
import { ActionMessage } from "./action-message";

export function GrowthControls({ enabled, canEnable, attribution }: { enabled: boolean; canEnable: boolean; attribution: "none" | "accepted" | "withdrawn" | "removed" }) {
  const [state, submit, pending] = useActionState(changeGrowth, initialState);
  return <div className="stack">
    <form action={submit}><button className="button" name="operation" value={enabled ? "disable" : "enable"} disabled={pending || (!enabled && !canEnable)}>{enabled ? "Disable referral link" : "Enable referral link"}</button></form>
    {!canEnable && !enabled && <p>Publish a profile to enable your referral link.</p>}
    <section className="stack" aria-labelledby="referral-choice-title">
      <h2 id="referral-choice-title">Your attribution choice</h2>
      <p>{attribution === "accepted" ? "Your consented referral is included in the sharing creator’s aggregate report." : attribution === "withdrawn" ? "Attribution withdrawn. This account cannot be attributed again." : attribution === "removed" ? "The referring creator’s account has been removed." : "No referral attribution has been recorded for this account."}</p>
      {attribution === "none" && <form action={submit}><button className="button" name="operation" value="accept" disabled={pending}>Retry signup referral credit</button></form>}
      {attribution !== "withdrawn" && <details><summary>Withdraw or prevent referral attribution</summary>
        <p>This removes your connection to the referring creator and prevents attribution again. A minimal exclusion marker remains until account deletion.</p>
        <form action={submit}><button className="button danger" name="operation" value="withdraw" disabled={pending}>Withdraw referral attribution</button></form>
      </details>}
    </section>
    <ActionMessage state={state} />
  </div>;
}
