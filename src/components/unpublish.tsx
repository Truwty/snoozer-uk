"use client";

import { useActionState } from "react";
import { unpublish } from "@/app/studio/unpublish";
import { initialState } from "@/lib/actions";
import { ActionMessage } from "./action-message";

export function Unpublish({ revision }: { revision: number }) {
  const [state, submit, pending] = useActionState(unpublish, initialState);
  return <form action={submit}>
    <input type="hidden" name="revision" value={revision} />
    <button className="button small" disabled={pending}>Take page offline</button>
    <ActionMessage state={state} />
  </form>;
}
