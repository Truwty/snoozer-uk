import { z } from "zod";
import { requireOwner } from "@/lib/owner/auth";
const schema=z.object({accounts:z.number(),profiles:z.number(),published:z.number(),owners:z.number()});
export default async function PlatformAnalytics() {
 const {client}=await requireOwner();const {data,error}=await client.rpc("owner_overview");const result=schema.safeParse(data);
 return <main className="stack"><h1>Platform analytics</h1><p className="muted">Aggregate account and publication overview. Detailed trend reporting is not yet implemented.</p>
 {error||!result.success?<p role="alert">Metrics unavailable.</p>:<div className="owner-metrics">{Object.entries(result.data).map(([key,value])=><div className="panel" key={key}><p className="muted">{key}</p><strong>{value.toLocaleString("en-GB")}</strong></div>)}</div>}
 </main>;
}
