"use client";
import { useActionState } from "react";
import { manageAlias } from "@/app/studio/alias-actions";
import { initialState } from "@/lib/actions";
import type { AliasInventory } from "@/lib/aliases";
import { ActionMessage } from "./action-message";

export function ProfileAliases({ profileId, inventory }: { profileId: string; inventory: AliasInventory }) {
  const [state, submit, pending] = useActionState(manageAlias, initialState);
  return <section className="stack" aria-labelledby="aliases-title">
    <h2 id="aliases-title">Profile aliases</h2>
    <p className="muted">{inventory.used} of {inventory.limit} account alias slots used. Aliases redirect to this profile after publication. They last 90 days, require an eligible plan and can be renewed. Expired or retired addresses stay reserved to prevent takeover. Up to 100 recent aliases are shown.</p>
    <form action={submit} className="stack">
      <input type="hidden" name="profile" value={profileId} /><input type="hidden" name="operation" value="create" />
      <label>New alias<input name="alias" required minLength={3} maxLength={30} autoCapitalize="none" autoComplete="off" spellCheck={false} /></label>
      <div><button className="button" disabled={pending || inventory.used >= inventory.limit}>Claim alias</button></div>
    </form>
    <ActionMessage state={state} />
    {inventory.items.length === 0 ? <p>No aliases for this profile yet.</p> : <ul className="alias-list">{inventory.items.map((item) => <li key={item.name} className="stack">
      <strong>@{item.name}</strong><p>{item.state === "plan-limit" ? "Paused by plan allowance" : item.state === "unpublished" ? "Waiting for profile publication" : item.state[0].toUpperCase() + item.state.slice(1)} · expires <time dateTime={item.expiresAt}>{new Date(item.expiresAt).toISOString().slice(0, 10)} UTC</time></p>
      {item.state === "active" && <a className="text-link" href={`/${item.name}`}>Open @{item.name}</a>}
      {item.state !== "retired" && <form action={submit} className="stack"><input type="hidden" name="profile" value={profileId} /><input type="hidden" name="alias" value={item.name} />
        <div><button className="button" name="operation" value="renew" disabled={pending || inventory.limit === 0}>Renew @{item.name} for 90 days</button></div>
        <details><summary>Retire @{item.name}</summary><p>Retirement immediately disables this alias and permanently reserves its address. It cannot be reused.</p><button className="button danger" name="operation" value="retire" disabled={pending}>Retire @{item.name} permanently</button></details>
      </form>}
    </li>)}</ul>}
  </section>;
}
