"use client";
import { useActionState } from "react";
import { changePublicationSchedule } from "@/app/studio/schedule-actions";
import { initialState } from "@/lib/actions";
import type { PublicationSchedule } from "@/lib/publication-schedule";
import { ActionMessage } from "./action-message";

export function SchedulePublication({ profileId, revision, current, automatic, enabled, captureDisabled }: { profileId: string; revision: number; current: PublicationSchedule | null; automatic: boolean; enabled: boolean; captureDisabled: boolean }) {
  const [state, submit, pending] = useActionState(changePublicationSchedule, initialState);
  const reasons = { manual: "Cancelled by you", superseded: "Superseded by another publication", plan_changed: "Your plan no longer permits this publication", quota: "Current plan limits were reached", snapshot_unavailable: "The saved version is unavailable", owner_unavailable: "Account verification is unavailable" };
  return <section className="stack" aria-labelledby="schedule-title">
    <h2 id="schedule-title">Scheduled publishing</h2>
    <p className="muted">Plus or higher is required. Schedule a frozen copy of your saved draft. Later draft edits leave it unchanged; publishing or taking your page offline cancels it.</p>
    <p className="muted">{automatic ? "Due versions are checked about every minute when the service is available. Delays are possible; use Check due publication to retry." : "Automatic publishing is not enabled here. Check due publication will activate the saved version after its due time."}</p>
    {current ? <p role="status">Version {current.revision} · {current.state} · <time dateTime={current.runAt}>{new Date(current.runAt).toISOString().slice(0, 16).replace("T", " ")} UTC</time>{current.reason && ` · ${reasons[current.reason]}`}</p> : <p>No scheduled publication.</p>}
    {captureDisabled && <p>Save your current draft before scheduling a version.</p>}
    <form action={submit} className="stack">
      <input type="hidden" name="profile" value={profileId} /><input type="hidden" name="revision" value={revision} /><input type="hidden" name="operation" value="create" />
      <label>Publish at (UTC)<input name="publish_at" type="datetime-local" step={60} required disabled={pending || captureDisabled || !enabled} /></label>
      <div><button className="button" disabled={pending || captureDisabled || !enabled}>{current?.state === "pending" ? "Replace scheduled version" : "Schedule saved draft"}</button></div>
    </form>
    {current?.state === "pending" && <form action={submit} className="actions"><input type="hidden" name="profile" value={profileId} /><button className="button" name="operation" value="check" disabled={pending}>Check due publication</button><button className="button danger" name="operation" value="cancel" disabled={pending}>Cancel scheduled publication</button></form>}
    <ActionMessage state={state} />
  </section>;
}
