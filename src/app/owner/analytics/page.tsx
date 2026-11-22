import { z } from "zod";
import { requireOwner } from "@/lib/owner/auth";
const schema=z.object({accounts:z.number(),profiles:z.number(),published:z.number(),owners:z.number()});
export default async function PlatformAnalytics() {
 const {client}=await requireOwner();const [overview,activity]=await Promise.all([client.rpc("owner_overview"),client.rpc("owner_analytics_days",{p_days:30})]);
 const {data,error}=overview;const result=schema.safeParse(data);
 const days=z.array(z.object({day:z.string(),views:z.number(),clicks:z.number()})).safeParse(activity.data);
 return <main className="stack"><h1>Platform analytics</h1><p className="muted">Aggregate account and publication overview. Detailed trend reporting is not yet implemented.</p>
 {error||!result.success?<p role="alert">Metrics unavailable.</p>:<div className="owner-metrics">{Object.entries(result.data).map(([key,value])=><div className="panel" key={key}><p className="muted">{key}</p><strong>{value.toLocaleString("en-GB")}</strong></div>)}</div>}
 {activity.error||!days.success?<p role="alert">Daily activity unavailable.</p>:<section className="panel stack"><h2>Daily profile activity (30 days)</h2><p className="muted">Aggregated consented events, not distinct people.</p><div className="owner-profiles-list"><table><thead><tr><th>Day</th><th>Views</th><th>Clicks</th></tr></thead><tbody>{days.data.map(d=><tr key={d.day}><td>{d.day}</td><td>{d.views.toLocaleString("en-GB")}</td><td>{d.clicks.toLocaleString("en-GB")}</td></tr>)}</tbody></table></div></section>}
 </main>;
}
