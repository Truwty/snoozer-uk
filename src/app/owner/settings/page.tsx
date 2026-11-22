import { z } from "zod";
import { requireOwner } from "@/lib/owner/auth";
import { changeRegistration } from "../actions";
const schema=z.object({registrations_enabled:z.object({value:z.boolean(),revision:z.number().int().positive(),updated_at:z.string()})});
export default async function OwnerSettings({searchParams}:{searchParams:Promise<{admin?:string}>}) {
 const {client}=await requireOwner();const {data,error}=await client.rpc("owner_get_settings");const state=schema.safeParse(data);
 const message=(await searchParams).admin;
 return <main className="stack"><h1>Platform settings</h1><p className="muted">Versioned, audited settings. Other system settings will be added only after their enforcement paths have been tested.</p>
 {message&&<p role="status">Result: {message}</p>}
 {error||!state.success?<p role="alert">Settings unavailable.</p>:<section className="panel stack"><h2>New registrations</h2>
 <p>Currently {state.data.registrations_enabled.value?"enabled":"disabled"}. Existing accounts can still sign in.</p>
 <form action={changeRegistration} className="stack"><input type="hidden" name="revision" value={state.data.registrations_enabled.revision}/>
 <label>Allow registration<select name="enabled" defaultValue={String(state.data.registrations_enabled.value)}><option value="true">Enabled</option><option value="false">Disabled</option></select></label>
 <label>Reason<input name="reason" required minLength={8} maxLength={500}/></label>
 <button className="button">Save setting (MFA required)</button></form></section>}
 </main>;
}
