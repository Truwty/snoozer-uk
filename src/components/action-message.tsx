import type { ActionState } from "@/lib/actions";

export function ActionMessage({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return <p className={`message ${state.status}`} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>;
}
