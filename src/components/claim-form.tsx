"use client";

import { useActionState, useState } from "react";
import { claim } from "@/app/studio/actions";
import { initialState } from "@/lib/actions";
import { canonicalUsername, username } from "@/lib/profile";
import { ActionMessage } from "./action-message";

export function ClaimForm() {
  const [state, submit, pending] = useActionState(claim, initialState);
  const [name, setName] = useState("");
  const [availability, setAvailability] = useState<{ name: string; message: string }>();
  const [checking, setChecking] = useState(false);

  async function check() {
    const nameAtRequest = name;
    const parsed = username.safeParse(canonicalUsername(nameAtRequest));
    if (!parsed.success) {
      setAvailability({ name: nameAtRequest, message: parsed.error.issues[0].message });
      return;
    }
    setChecking(true);
    try {
      const response = await fetch(`/api/v1/usernames/${parsed.data}`, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error();
      const { available } = await response.json();
      setAvailability({ name: nameAtRequest, message: available ? "Available. Claim it to reserve it." : "That address is unavailable." });
    } catch {
      setAvailability({ name: nameAtRequest, message: "Couldn’t check availability. Try again." });
    } finally {
      setChecking(false);
    }
  }

  return <form action={submit} className="stack">
    <label htmlFor="username">Username</label>
    <div className="address">
      <span>snoozer.uk/</span>
      <input id="username" name="username" autoComplete="off" autoCapitalize="none" spellCheck={false}
        minLength={3} maxLength={30} value={name} onChange={(event) => setName(event.target.value)} required />
    </div>
    {availability?.name === name && <p className="message" role="status">{availability.message}</p>}
    <div className="actions">
      <button className="button" type="button" disabled={checking || pending} onClick={check}>{checking ? "Checking…" : "Check availability"}</button>
      <button className="button primary" disabled={pending}>{pending ? "Claiming…" : "Claim address"}</button>
    </div>
    <ActionMessage state={state} />
  </form>;
}
