import { z } from "zod";
import { requireOwner } from "@/lib/owner/auth";
import { reviewCommunityTemplate } from "./actions";

export const metadata={title:"Community template review",robots:{index:false,follow:false}};

export default async function CommunityTemplateReview({searchParams}:{searchParams:Promise<{saved?:string;error?:string}>}) {
  const {client}=await requireOwner(); const [{data,error},params]=await Promise.all([client.rpc("owner_community_template_queue"),searchParams]);
  const queue=z.array(z.object({id:z.uuid(),title:z.string(),description:z.string(),config:z.record(z.string(),z.unknown()),owner_id:z.uuid(),created_at:z.string(),reports:z.array(z.object({reason:z.string(),created_at:z.string()}))})).safeParse(data);
  return <main className="shell stack"><header className="stack"><p className="eyebrow">OWNER / MODERATION</p><h1>Community template review</h1><p className="muted">Templates remain private until approved. Review configuration as data; it is never evaluated as code.</p></header>
    {params.saved&&<p className="message" role="status">Review decision saved.</p>}{params.error&&<p className="message error" role="alert">The review decision could not be saved.</p>}
    {error||!queue.success?<p role="alert">The moderation queue is unavailable.</p>:queue.data.length===0?<p className="muted">No templates are waiting for review.</p>:queue.data.map((item)=><article className="panel stack" key={item.id}>
      <p className="eyebrow">Submitted {new Date(item.created_at).toLocaleString("en-GB")}</p><h2>{item.title}</h2><p>{item.description}</p><p className="muted">Creator: {item.owner_id}</p>
      <details><summary>Safe declarative configuration</summary><pre>{JSON.stringify(item.config,null,2)}</pre></details>
      {item.reports.length>0&&<details><summary>{item.reports.length} report(s)</summary><ul>{item.reports.map((report,index)=><li key={index}>{report.reason}</li>)}</ul></details>}
      <div className="actions"><form action={reviewCommunityTemplate}><input type="hidden" name="id" value={item.id}/><input type="hidden" name="status" value="approved"/><button className="button primary" type="submit">Approve</button></form>
        <form action={reviewCommunityTemplate}><input type="hidden" name="id" value={item.id}/><input type="hidden" name="status" value="rejected"/><button className="button" type="submit">Reject</button></form></div>
    </article>)}
  </main>;
}
