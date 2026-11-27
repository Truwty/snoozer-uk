"use client";

import { useActionState, useCallback, useEffect, useId, useState } from "react";
import { claim, claimAdditional } from "@/app/studio/actions";
import { initialState } from "@/lib/actions";
import { canonicalUsername, username } from "@/lib/profile";
import { ActionMessage } from "./action-message";
import type { AccountLocale } from "@/lib/account-locale";
import { homeContent } from "@/lib/home-translations";

export function ClaimForm({
  additional = false,
  hero = false,
  locale = "en-US",
}: {
  additional?: boolean;
  hero?: boolean;
  locale?: AccountLocale;
}) {
  const copy = homeContent(locale).claimForm;
  const usernameId = useId().replace(/:/g, "");
  const [state, submit, pending] = useActionState(additional ? claimAdditional : claim, initialState);
  const [name, setName] = useState("");
  const [availability, setAvailability] = useState<{ name: string; message: string }>();
  const [checking, setChecking] = useState(false);

  const check = useCallback(async () => {
    const nameAtRequest = name;
    const parsed = username.safeParse(canonicalUsername(nameAtRequest));
    if (!parsed.success) {
      setAvailability({ name: nameAtRequest, message: copy.invalid });
      return;
    }
    setChecking(true);
    try {
      const response = await fetch(`/api/v1/usernames/${parsed.data}`, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error();
      const { available } = await response.json();
      setAvailability({ name: nameAtRequest, message: available ? copy.available : copy.unavailable });
    } catch {
      setAvailability({ name: nameAtRequest, message: copy.checkFailed });
    } finally {
      setChecking(false);
    }
  }, [name, copy]);

  useEffect(() => {
    if (!hero || !name) return;
    const timer = window.setTimeout(() => void check(), 400);
    return () => window.clearTimeout(timer);
  }, [hero, name, check]);

  return <form action={submit} className={hero ? "stack hero-claim" : "stack"}>
    <label htmlFor={usernameId} className={hero ? "home-claim-label" : undefined}>{copy.username}</label>
    <div className="address">
      <span>snoozer.uk/</span>
      <input id={usernameId} name="username" autoComplete="off" autoCapitalize="none" spellCheck={false}
        minLength={3} maxLength={30} value={name} onChange={(event) => setName(event.target.value)} required />
    </div>
    {availability?.name === name && <p className="message" role="status">{availability.message}</p>}
    <div className="actions">
      {!hero && <button className="button" type="button" disabled={checking || pending} onClick={() => void check()}>{checking ? copy.checking : copy.checkAvailability}</button>}
      <button className="button primary" disabled={pending}>{pending ? copy.claiming : hero ? copy.claimNow : copy.claimAddress}</button>
    </div>
    <ActionMessage state={state} />
  </form>;
}
