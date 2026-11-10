"use client";

import { useActionState } from "react";
import { deleteProfile } from "@/app/studio/delete";
import { initialState } from "@/lib/actions";
import { ActionMessage } from "./action-message";

export function DeleteProfile({ username, revision }: { username: string; revision: number }) {
  const [state, submit, pending] = useActionState(deleteProfile, initialState);

  return <section className="panel stack">
    <h2>Delete profile</h2>
    <p className="muted">Deleting your profile removes your page, drafts, links and publish history. Your username will be retired. You can sign in and claim a different address.</p>
    <details>
      <summary>Review profile deletion</summary>
      <form className="stack" action={submit}>
        <input type="hidden" name="username" value={username} />
        <input type="hidden" name="revision" value={revision} />
        <label>Type {username} to confirm
          <input name="confirmation" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={30} required />
        </label>
        <div><button className="button" disabled={pending}>{pending ? "Deleting…" : "Permanently delete profile"}</button></div>
        <ActionMessage state={state} />
      </form>
    </details>
  </section>;
}
