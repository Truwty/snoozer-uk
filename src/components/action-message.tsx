import { Toast } from "./ui";
import type { ActionState } from "@/lib/actions";

export function ActionMessage({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return <Toast message={state.message} kind={state.status} />;
}
