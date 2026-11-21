"use client";

import { useActionState, useId, useState } from "react";
import { initialState, type ActionState } from "@/lib/actions";
import { Button, Field } from "./ui";
import { ActionMessage } from "./action-message";

export function AuthForm({ action, label, email, password, token, referral, addAccount = false }: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  label: string;
  email?: boolean;
  password?: "current" | "new";
  token?: string;
  referral?: string;
  addAccount?: boolean;
}) {
  const [state, submit, pending] = useActionState(action, initialState);
  const [visible, setVisible] = useState(false);
  const [length, setLength] = useState(0);
  const [errors, setErrors] = useState({ email: "", password: "" });
  const id = useId();
  return <form action={submit} className="stack">
    {addAccount && <input type="hidden" name="add_account" value="1" />}
    {email && <Field label="Email address"><input name="email" type="email" autoComplete="email" required maxLength={254}
      aria-invalid={!!errors.email} aria-describedby={errors.email ? id + "-email" : undefined}
      onBlur={(event) => setErrors((current) => ({ ...current, email: event.target.value && !event.target.validity.valid ? event.target.validationMessage : "" }))} />
      {errors.email && <span id={id + "-email"} className="message error">{errors.email}</span>}
    </Field>}
    {password && <div className="password-field">
      <Field label={password === "new" ? "New password" : "Password"}>
        <input name="password" type={visible ? "text" : "password"} autoComplete={`${password}-password`}
          required minLength={password === "new" ? 12 : undefined} maxLength={password === "new" ? 72 : 256}
          aria-invalid={!!errors.password} aria-describedby={password === "new" ? id + "-password" : undefined}
          onChange={(event) => { setLength(event.target.value.length); setErrors((current) => ({ ...current, password: "" })); }}
          onBlur={(event) => setErrors((current) => ({ ...current, password: event.target.value && !event.target.validity.valid ? event.target.validationMessage : "" }))} />
      </Field>
      <button type="button" className="password-toggle" aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? "Hide" : "Show"}</button>
      {password === "new" && <small id={id + "-password"} className={length >= 12 ? "password-valid" : "muted"} aria-live="polite">12+ characters{length >= 12 ? " · Met" : ""}</small>}
      {errors.password && <p className="message error">{errors.password}</p>}
    </div>}
    {referral && <fieldset className="stack"><legend>Optional referral credit</legend>
      <input type="hidden" name="referral" value={referral} />
      <label><input type="checkbox" name="referral_consent" /> Credit the creator who shared this link. Snoozer will count my verified account and profile progress in their aggregate report.</label>
      <small className="muted">No names or email addresses are shared. No rewards are granted. You can withdraw in Growth after signing in. Verification within 24 hours of signup is required.</small>
    </fieldset>}
    {token && <input type="hidden" name="token_hash" value={token} />}
    <Button variant="primary" disabled={pending}>{pending ? "Working…" : label}</Button>
    <ActionMessage state={state} />
  </form>;
}
