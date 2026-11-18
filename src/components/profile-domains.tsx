"use client";
import { useActionState } from "react";
import { manageDomain } from "@/app/studio/domain-actions";
import { initialState } from "@/lib/actions";
import type { z } from "zod";
import { renderApexAddress, type domainInventory } from "@/lib/domains";
import { ActionMessage } from "./action-message";

export function ProfileDomains({ profileId, inventory, verificationEnabled, serviceHost }: { profileId: string; inventory: z.infer<typeof domainInventory>; verificationEnabled: boolean; serviceHost?: string }) {
  const [state, submit, pending] = useActionState(manageDomain, initialState);
  const id = <input type="hidden" name="profile" value={profileId} />;
  return <section className="stack profile-domains" aria-labelledby="domains-title">
    <h2 id="domains-title">Custom domain</h2>
    <p>{inventory.used} of {inventory.quota} account connections reserved. One domain per profile. Connection requests need operator approval and available hosting capacity; submitting a request makes no purchase.</p>
    <form action={submit} className="stack">{id}<input type="hidden" name="operation" value="request" />
      <label>Domain hostname<input name="hostname" maxLength={220} required autoCapitalize="none" spellCheck={false} placeholder="links.example.com" disabled={pending || inventory.quota === 0} /></label>
      <div><button className="button" disabled={pending || inventory.quota === 0}>Request domain connection</button></div>
    </form>
    {inventory.quota === 0 && <p>Your current plan does not include custom domains.</p>}
    {!verificationEnabled && <p>Verification is awaiting operator configuration. Requests and disconnection remain available; new domains will not activate yet.</p>}
    {!inventory.items.length && <p>No domain requests for this profile.</p>}
    <ul className="stack">{inventory.items.map((item) => <li className="stack" key={item.id}>
      <strong>{item.hostname}</strong><p>Status: {item.state === "active" ? "Connected; routing requires current verification and a published profile" : item.state}{item.verifiedUntil && ` · routing verification expires ${new Date(item.verifiedUntil).toISOString()}`}</p>
      {["pending", "provisioning", "active"].includes(item.state) && <>
        <p>Add a TXT record at <code>_snoozer.{item.hostname}</code> with this exact value: <code>{item.challenge}</code>. Keep it in place for renewal. New requests expire after 24 hours; an active connection can renew its current proof.</p>
        {serviceHost && <p>After approval, point a subdomain CNAME to <code>{serviceHost}</code>. For a root domain, use the provider’s supplied DNS instructions (Render’s current A address is <code>{renderApexAddress}</code>). Remove conflicting AAAA/forwarding records for this hostname and preserve mail records.</p>}
        <p>Verification checks DNS, the approved provider association and HTTPS. Publishing is separate. A stale proof, missing publication or plan limit pauses routing. Rechecks can delay the first visit after expiry.</p>
        <form action={submit}>{id}<input type="hidden" name="request" value={item.id} /><button className="button" name="operation" value="verify" disabled={pending || !verificationEnabled}>Verify {item.hostname}</button></form>
      </>}
      {!["retired", "expired", "transferred", "disconnecting"].includes(item.state) && <form action={submit}>{id}<input type="hidden" name="request" value={item.id} /><button className="button" name="operation" value="disconnect" disabled={pending}>{item.state === "pending" ? "Cancel request for " : "Disconnect "}{item.hostname}</button></form>}
      {item.state === "disconnecting" && <><p>Routing has stopped. Ask the operator to remove the Render association before confirming removal. Profile/account deletion stays blocked until this is confirmed.</p><form action={submit}>{id}<input type="hidden" name="request" value={item.id} /><button className="button" name="operation" value="confirm-removal" disabled={pending || !verificationEnabled}>Confirm provider removal for {item.hostname}</button></form></>}
    </li>)}</ul>
    <ActionMessage state={state} />
  </section>;
}
