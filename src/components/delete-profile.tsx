"use client";

import { useActionState, useRef } from "react";
import { deleteProfile } from "@/app/studio/delete";
import { initialState } from "@/lib/actions";
import { ActionMessage } from "./action-message";

export function DeleteProfile({ profileId, username, revision }: { profileId: string; username: string; revision: number }) {
  const [state, submit, pending] = useActionState(deleteProfile, initialState);

  const dialog = useRef<HTMLDialogElement>(null);
  return <details className="danger-zone">
    <summary>Delete profile</summary>
    <section className="stack">
    <h2 id="delete-profile-title">Delete profile</h2>
    <p className="muted">Deleting your profile removes your page, drafts, links and publish history. Your username will be retired. You can sign in and claim a different address.</p>
    <button type="button" className="button danger" onClick={() => dialog.current?.showModal()}>Review profile deletion</button>
    <dialog ref={dialog} aria-labelledby="delete-profile-title">
      <form className="stack" action={submit}>
        <button type="button" className="button" onClick={() => dialog.current?.close()}>Cancel</button>
        <input type="hidden" name="profileId" value={profileId} />
        <input type="hidden" name="username" value={username} />
        <input type="hidden" name="revision" value={revision} />
        <label>Type {username} to confirm
          <input name="confirmation" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={30} required />
        </label>
        <div><button className="button danger" disabled={pending}>{pending ? "Deleting…" : "Permanently delete profile"}</button></div>
        <ActionMessage state={state} />
      </form>
    </dialog>
  </section></details>;
}
