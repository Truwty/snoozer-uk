"use client";

import { useActionState } from "react";
import { restorePublication } from "@/app/studio/history/restore";
import { initialState } from "@/lib/actions";
import { ActionMessage } from "./action-message";

export function RestorePublication({ revision, draftRevision }: { revision: number; draftRevision: number }) {
  const [state, submit, pending] = useActionState(restorePublication, initialState);
  return <form className="stack" action={submit}>
    <input type="hidden" name="revision" value={revision} />
    <input type="hidden" name="draftRevision" value={draftRevision} />
    <p>This replaces your current draft. Publish the restored draft when you’re ready to update the live page.</p>
    <div><button className="button primary" disabled={pending}>{pending ? "Restoring…" : "Restore to draft"}</button></div>
    <ActionMessage state={state} />
  </form>;
}
