"use client";

import { useActionState } from "react";
import { initialState, type ActionState } from "@/lib/actions";
import { ActionMessage } from "./action-message";

export function AuthForm({ action, label, email, password, token }: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  label: string;
  email?: boolean;
  password?: "current" | "new";
  token?: string;
}) {
  const [state, submit, pending] = useActionState(action, initialState);
  return <form action={submit} className="stack">
    {email && <label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>}
    {password && <label>{password === "new" ? "New password" : "Password"}
      <input name="password" type="password" autoComplete={`${password}-password`}
        required minLength={password === "new" ? 12 : undefined} maxLength={password === "new" ? 72 : 256} />
      {password === "new" && <small>Use at least 12 characters.</small>}
    </label>}
    {token && <input type="hidden" name="token_hash" value={token} />}
    <button className="button primary" disabled={pending}>{pending ? "Working…" : label}</button>
    <ActionMessage state={state} />
  </form>;
}
