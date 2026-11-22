import Link from "next/link";
import {changeProviderBan} from "../provider-ban-actions";
import {providerBanConfigured} from "@/lib/owner/provider-ban-config";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireOwner } from "@/lib/owner/auth";
import { restrictAccount,liftRestriction,addOwnerNote,grantPremium,revokePremium,openModerationCase,revokeAccountSessions } from "../../actions";
const uuid=z.uuid();
const banPreflightSchema=z.object({
 user_exists:z.boolean(),is_owner:z.boolean(),internal_ban:z.boolean(),
 active_restriction:z.boolean(),auth_banned:z.boolean(),
 eligible_cases:z.array(z.object({id:uuid,status:z.string()})),
});
const providerMessages:Record<string,string>={
 "invalid":"Review the ban form values, case and duration.",
 "provider-disabled":"Provider-level bans are unavailable or the independent email appeal sender is not configured.",
 "mfa-required":"Your current session is not AAL2. Complete Owner MFA before using provider controls.",
 "internal-ban-required":"Apply an internal indefinite ban first; provider bans cannot bypass this safeguard.",
 "case-required":"Create or action a moderation case for this account before the provider ban.",
 "internal-restriction-active":"Lift all active internal restrictions before unbanning in Supabase Auth.",
 "pending-operation":"A provider operation is still pending. Review the audit before retrying.",
 "provider-updated":"Supabase Auth provider access was updated and the operation audited.",
 "provider-failed":"The provider rejected the update. Check the audit and account status.",
 "reconciliation-required":"Provider response could not be reconciled with the audit. Stop and investigate.",
 "denied":"The provider operation was denied. Check the readiness checklist and Owner MFA.",
};
const detailSchema=z.object({
 id:uuid,email:z.string().nullable(),verified:z.boolean(),created_at:z.string(),is_owner:z.boolean(),
 profiles:z.array(z.object({id:uuid,username:z.string(),published:z.boolean()})),
 restrictions:z.array(z.object({id:uuid,kind:z.string(),reason:z.string(),ends_at:z.string().nullable(),revoked_at:z.string().nullable(),created_at:z.string()})),
 grants:z.array(z.object({id:uuid,plan:z.string(),source:z.string(),expires_at:z.string(),revoked_at:z.string().nullable()})),
 notes:z.array(z.object({note:z.string(),created_at:z.string()})),
});
export default async function Account({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<{admin?:string}>}) {
 const {id}=await params; const admin=(await searchParams).admin;
 if(!uuid.safeParse(id).success)notFound();
 const {client}=await requireOwner();
 const {data,error}=await client.rpc("owner_user_detail",{p_user:id});
 if(error)throw new Error("Account details unavailable");
 const parsed=detailSchema.safeParse(data);
 if(!parsed.success)notFound();
 const u=parsed.data;
 const [sessionResult,banResult,mfaResult]=await Promise.all([
  client.rpc("owner_session_summary",{p_user:id}),
  client.rpc("owner_provider_ban_preflight",{p_user:id}),
  client.auth.mfa.getAuthenticatorAssuranceLevel(),
 ]);
 const sessionData=sessionResult.data;
 const readiness=banPreflightSchema.safeParse(banResult.data);
 const banState=readiness.success?readiness.data:null;
 const isAal2=mfaResult.data?.currentLevel==="aal2"&&!mfaResult.error;
 const banCases=banState?.eligible_cases??[];
 const banReady=providerBanConfigured()&&isAal2&&!u.is_owner&&
   Boolean(banState?.internal_ban)&&banCases.length>0&&!banState?.auth_banned;
 const unbanReady=providerBanConfigured()&&isAal2&&!u.is_owner&&
   Boolean(banState?.auth_banned)&&!banState?.active_restriction;
 const sessions=z.object({active_sessions:z.number().int().nonnegative(),latest_login:z.string().nullable()}).safeParse(sessionData);
 return <main className="stack">
  <div className="actions"><Link href="/owner/users">← All accounts</Link><Link href="/owner/security">Owner MFA</Link></div>
  <h1>Account details</h1><p>{u.email??"No email"} · <code>{u.id}</code> {u.is_owner&&<strong>Owner protected</strong>}</p>
  <p className="muted">{u.verified?"Verified":"Not verified"} · Created {new Date(u.created_at).toLocaleDateString("en-GB")}</p>
  {admin&&<p role="status">Result: {providerMessages[admin]??(admin==="denied"?"Operation denied. Check MFA, permissions and inputs.":admin)}</p>}
  <section className="panel stack"><h2>Profiles</h2>{u.profiles.length===0?<p>None</p>:u.profiles.map(p=><p key={p.id}>@{p.username} — {p.published?"Published":"Draft"} {p.published&&<Link href={"/"+p.username}>View</Link>}</p>)}</section>
  <section className="panel stack"><h2>Session security</h2>
   <p>{sessions.success?`${sessions.data.active_sessions} active session(s)`:"Session metrics unavailable"}</p>
   {sessions.success&&sessions.data.latest_login&&<p className="muted">Most recent sign-in: {new Date(sessions.data.latest_login).toLocaleString("en-GB")}</p>}
   {!u.is_owner&&<form action={revokeAccountSessions} className="stack"><input type="hidden" name="user" value={id}/>
    <label>Revocation reason<input name="reason" minLength={8} maxLength={500} required/></label>
    <button className="button">Revoke all account sessions (MFA required)</button></form>}
  </section>
  <section className="panel stack"><h2>Restrictions</h2>
   {u.restrictions.length===0?<p>None</p>:u.restrictions.map(r=><div key={r.id} className="stack">
    <p>{r.kind} · {r.revoked_at?"Lifted":r.ends_at?"Until "+new Date(r.ends_at).toLocaleDateString("en-GB"):"Indefinite"} · {r.reason}</p>
    {!r.revoked_at&&!u.is_owner&&<form action={liftRestriction} className="actions"><input type="hidden" name="user" value={id}/><input type="hidden" name="id" value={r.id}/><input name="reason" required minLength={8} maxLength={500} placeholder="Reason for reinstatement"/><button className="button">Lift restriction</button></form>}
   </div>)}
   {!u.is_owner&&<form action={restrictAccount} className="stack"><h3>Restrict account</h3><input type="hidden" name="user" value={id}/>
    <label>Action<select name="kind" defaultValue="suspension"><option value="suspension">Temporary suspension</option><option value="ban">Indefinite ban</option></select></label>
    <label>Days (for suspension)<input name="days" type="number" defaultValue={7} min={1} max={365}/></label>
    <label>Reason<input name="reason" required minLength={8} maxLength={500}/></label>
    <button className="button" type="submit">Apply restriction (MFA required)</button>
   </form>}
  </section>
  <section className="panel stack">
   <h2>Supabase Auth provider access</h2>
   <p className="muted">Additional provider-level controls. Requires an active internal ban and an actioned moderation case. An email-verified appeal route at /appeal/external must be tested with your Zoho sender before enabling these controls. The Owner registry cannot be banned.</p>
   <p>{providerBanConfigured()?"Provider controls enabled. Every write still requires an Owner AAL2 session and database preconditions.":"Provider controls disabled or the verified email appeal sender is unavailable."}</p>
   {!u.is_owner && providerBanConfigured() && <>
    <section className="stack" aria-label="Provider ban prerequisites">
     <h3>Provider ban readiness</h3>
     {!banState?<p role="alert">Readiness check unavailable: provider actions are blocked until refreshed.</p>:<>
      <p>Owner MFA: <strong>{isAal2?"AAL2 verified":"AAL2 required"}</strong> · Internal indefinite ban: <strong>{banState.internal_ban?"Active":"Not active"}</strong> · Eligible moderation cases: <strong>{banCases.length}</strong> · Provider currently banned: <strong>{banState.auth_banned?"Yes":"No"}</strong></p>
      {!isAal2&&<p role="alert">Complete <Link href="/owner/security">Owner MFA</Link>, then reload this page.</p>}
      {!banState.internal_ban&&!banState.auth_banned&&<p role="alert">Apply an internal <strong>Indefinite ban</strong> in Restrictions above. Suspensions do not qualify for provider bans.</p>}
      {banCases.length===0&&<p role="alert">Create a moderation case below and mark it <strong>actioned</strong> in <Link href="/owner/moderation">Moderation</Link>.</p>}
      {banState.auth_banned&&banState.active_restriction&&<p role="alert">For reinstatement, lift the internal restriction before unbanning the provider account.</p>}
     </>}
    </section>
    <form action={changeProviderBan} className="stack">
     <input type="hidden" name="user" value={id}/>
     <input type="hidden" name="operation" value="ban"/>
     <h3>Apply provider ban</h3>
     <label>Linked eligible case
      <select name="case" required disabled={!banReady} defaultValue="">
       <option value="" disabled>Select a verified case</option>
       {banCases.map(c=><option key={c.id} value={c.id}>{c.id} ({c.status})</option>)}
      </select>
     </label>
     <label>Provider ban hours<input name="hours" type="number" min={1} max={876000} defaultValue={1} required disabled={!banReady}/></label>
     <label>Reason<input name="reason" minLength={8} maxLength={500} required disabled={!banReady}/></label>
     <button className="button" disabled={!banReady}>Ban in Supabase Auth (MFA required)</button>
     {!banReady&&<p className="muted">Unavailable until every readiness check above passes.</p>}
    </form>
    <form action={changeProviderBan} className="stack">
     <input type="hidden" name="user" value={id}/>
     <input type="hidden" name="operation" value="unban"/>
     <h3>Lift provider ban</h3>
     <p>Lift every active internal restriction first. Existing paid Premium is unchanged.</p>
     <label>Reason<input name="reason" minLength={8} maxLength={500} required disabled={!unbanReady}/></label>
     <button className="button" disabled={!unbanReady}>Unban in Supabase Auth (MFA required)</button>
     {!unbanReady&&<p className="muted">Only available for an Auth-banned account with no active internal restriction and verified AAL2.</p>}
    </form>
   </>}
  </section>
  <section className="panel stack"><h2>Premium entitlements</h2>
   {u.grants.map(g=><div key={g.id} className="stack">
    <p>{g.plan} · {g.source} · expires {new Date(g.expires_at).toLocaleDateString("en-GB")} · {g.revoked_at?"Revoked":"Active or expired"}</p>
    {g.source==="staff"&&!g.revoked_at&&!u.is_owner&&<form action={revokePremium} className="actions"><input type="hidden" name="user" value={id}/><input type="hidden" name="id" value={g.id}/><input name="reason" placeholder="Reason for revocation" minLength={8} maxLength={500} required/><button className="button">Revoke Owner grant</button></form>}
   </div>)}
   {!u.is_owner&&<form action={grantPremium} className="stack"><h3>Complimentary Premium</h3><input type="hidden" name="user" value={id}/>
    <label>Plan<select name="plan" defaultValue="pro"><option value="plus">Plus</option><option value="pro">Pro</option><option value="studio">Studio</option></select></label>
    <label>Days<input type="number" name="days" defaultValue={30} min={1} max={3650}/></label>
    <label>Reason<input name="reason" minLength={8} maxLength={500} required/></label>
    <button className="button">Grant Premium (MFA required)</button>
   </form>}
  </section>
  <section className="panel stack"><h2>Moderation case</h2><form action={openModerationCase} className="stack"><input type="hidden" name="user" value={id}/>
   <label>Category<select name="category"><option value="spam">Spam</option><option value="phishing">Phishing</option><option value="impersonation">Impersonation</option><option value="harassment">Harassment</option><option value="malware">Malware</option><option value="copyright">Copyright</option><option value="other">Other</option></select></label>
   <label>Reason<textarea name="reason" minLength={8} maxLength={1000} required/></label><button className="button">Open case</button></form></section>
  <section className="panel stack"><h2>Private support notes</h2>{u.notes.map((n,i)=><p key={i}>{n.note} · {new Date(n.created_at).toLocaleString("en-GB")}</p>)}
   <form action={addOwnerNote} className="stack"><input type="hidden" name="user" value={id}/><label>Note<textarea name="note" minLength={5} maxLength={2000} required/></label><button className="button">Save note</button></form></section>
 </main>;
}
