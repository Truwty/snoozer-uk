import { z } from "zod";
import { requireOwner } from "@/lib/owner/auth";
import { changeRegistration, changeEffectsSetting, changeMaintenanceSetting } from "../actions";

const entry = z.object({ value: z.boolean(), revision: z.number().int().positive(), updated_at: z.string() });
const schema = z.object({
 registrations_enabled: entry,
 effects_enabled: entry,
 maintenance_enabled: entry,
});

export default async function OwnerSettings({ searchParams }: { searchParams: Promise<{ admin?: string }> }) {
 const { client } = await requireOwner();
 const { data, error } = await client.rpc("owner_get_settings");
 const state = schema.safeParse(data);
 const message = (await searchParams).admin;
 return <main className="stack">
  <h1>Platform settings</h1>
  <p className="muted">Owner-only, revision-controlled switches. Every change requires verified MFA (AAL2), a reason and an audit record.</p>
  {message && <p role="status">Result: {message}</p>}
  {error || !state.success ? <p role="alert">Settings unavailable. No changes were made.</p> : <>
   <section className="panel stack">
    <h2>Visitor-facing maintenance</h2>
    <p>Currently <strong>{state.data.maintenance_enabled.value ? "ACTIVE" : "off"}</strong>. When active, visitors see a 503 maintenance notice on public pages and creator domains. The Owner centre, login, legal pages, appeals, health checks, authentication callbacks and API endpoints (including Stripe webhooks) remain reachable for recovery and payment safety. This is not a provider-level shutdown.</p>
    <form action={changeMaintenanceSetting} className="stack">
     <input type="hidden" name="revision" value={state.data.maintenance_enabled.revision} />
     <label>Maintenance mode<select name="enabled" defaultValue={String(state.data.maintenance_enabled.value)}><option value="false">Disabled</option><option value="true">Enabled</option></select></label>
     <label>Reason<input name="reason" required minLength={8} maxLength={500}/></label>
     <button className="button">Save maintenance setting (MFA required)</button>
    </form>
   </section>
   <section className="panel stack">
    <h2>Profile animations and effects</h2>
    <p>Currently <strong>{state.data.effects_enabled.value ? "enabled" : "disabled"}</strong>. Disabling turns off public profile effects across free and Premium profiles. Saved effect preferences are preserved.</p>
    <form action={changeEffectsSetting} className="stack">
     <input type="hidden" name="revision" value={state.data.effects_enabled.revision} />
     <label>Allow public profile effects<select name="enabled" defaultValue={String(state.data.effects_enabled.value)}><option value="true">Enabled</option><option value="false">Disabled</option></select></label>
     <label>Reason<input name="reason" required minLength={8} maxLength={500}/></label>
     <button className="button">Save effects setting (MFA required)</button>
    </form>
   </section>
   <section className="panel stack">
    <h2>New email registrations</h2>
    <p>Currently <strong>{state.data.registrations_enabled.value ? "enabled" : "disabled"}</strong>. Existing accounts can still sign in. First-time Discord OAuth registrations are not controlled by this switch.</p>
    <form action={changeRegistration} className="stack">
     <input type="hidden" name="revision" value={state.data.registrations_enabled.revision}/>
     <label>Allow email registration<select name="enabled" defaultValue={String(state.data.registrations_enabled.value)}><option value="true">Enabled</option><option value="false">Disabled</option></select></label>
     <label>Reason<input name="reason" required minLength={8} maxLength={500}/></label>
     <button className="button">Save registration setting (MFA required)</button>
    </form>
   </section>
  </>}
 </main>;
}
