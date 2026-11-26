"use client";

import { useActionState } from "react";
import { changeProfileUsername } from "@/app/studio/username-actions";
import { initialState } from "@/lib/actions";
import { ActionMessage } from "./action-message";

export function ProfileUsernameChange({ profileId, username }: { profileId: string; username: string }) {
  const [state, submit, pending] = useActionState(changeProfileUsername, initialState);
  return <section className="stack" aria-labelledby="username-change-title">
    <h2 id="username-change-title">Change username</h2>
    <p className="muted">Your old address will remain reserved and permanently redirect to this profile. You can make another change after 30 days.</p>
    <form action={submit} className="stack">
      <input type="hidden" name="profile" value={profileId}/>
      <label>New username<input name="username" required minLength={3} maxLength={30} pattern="[a-z][a-z0-9-]{1,28}[a-z0-9]"
        defaultValue={username} autoCapitalize="none" autoComplete="off" spellCheck={false} aria-describedby="username-change-help"/></label>
      <p id="username-change-help" className="muted">Lowercase letters, numbers and hyphens; start with a letter and end with a letter or number.</p>
      <label className="check"><input type="checkbox" name="confirm_redirect" required/> I understand my old username will permanently redirect and cannot be reclaimed.</label>
      <div><button className="button" type="submit" disabled={pending}>{pending ? "Changing…" : "Change username"}</button></div>
    </form>
    <ActionMessage state={state}/>
  </section>;
}
