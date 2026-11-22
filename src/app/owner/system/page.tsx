import Link from "next/link";
import {providerStatuses} from "@/lib/owner/provider-status";
import {z} from "zod";
import {requireOwner} from "@/lib/owner/auth";
const schema=z.object({active_sessions:z.number(),verified_accounts:z.number(),new_accounts_24h:z.number(),
 active_restrictions:z.number(),open_cases:z.number(),latest_admin_action:z.string().nullable()});
export default async function OwnerSystem() {
 const {client}=await requireOwner();
 const [{data,error},providers]=await Promise.all([client.rpc("owner_system_health"),providerStatuses()]);
 const result=schema.safeParse(data);
 return <main className="stack"><h1>Platform operations</h1>
 <p className="muted">Private aggregate system state. Provider deployment and incident controls remain in Render and Supabase dashboards.</p>
 <div className="actions"><Link className="button" href="/studio/billing-diagnostics">Billing diagnostics</Link>
 <Link className="button" href="/owner/security">Owner MFA</Link></div>
 {error||!result.success?<p role="alert">System metrics unavailable.</p>:<div className="owner-metrics">
 {Object.entries(result.data).map(([key,value])=><div className="panel" key={key}><p className="muted">{key.replaceAll("_"," ")}</p>
 <strong>{typeof value==="number"?value.toLocaleString("en-GB"):value?new Date(value).toLocaleString("en-GB"):"—"}</strong></div>)}
 </div>}
 <section className="panel stack"><h2>Public provider incident status</h2>
 <p className="muted">Read-only information from the providers' public status pages. This does not establish the health of Snoozer's particular Render service, Supabase database or Stripe account.</p>
 <div className="owner-metrics">
 {providers.map(p=><div className="panel stack" key={p.provider}><h3><a href={p.url} target="_blank" rel="noopener noreferrer">{p.provider} status</a></h3>
 <p><strong>{p.indicator==="none"?"Operational (public status)":p.indicator==="unknown"?"Unavailable":p.indicator}</strong></p>
 <p>{p.description}</p><p className="muted">{p.checked_at?"Checked "+new Date(p.checked_at).toLocaleTimeString("en-GB"):"Verify on provider status site"}</p>
 </div>)}</div></section>
 <section className="panel stack"><h2>Operational safeguards</h2><p>Changes to production secrets, deployment configuration and Stripe account settings require separate provider access. This page never exposes credentials.</p></section>
 </main>;
}
