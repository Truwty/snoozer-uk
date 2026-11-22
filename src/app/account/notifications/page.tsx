import Link from "next/link";
import {redirect} from "next/navigation";
import {z} from "zod";
import {sessionClient} from "@/lib/supabase";
import {readNotification} from "../privacy-actions";
export const metadata={title:"Account notices · Snoozer",robots:{index:false,follow:false}};
export const dynamic="force-dynamic";
const schema=z.array(z.object({
 id:z.uuid(),kind:z.string(),title:z.string(),body:z.string(),
 created_at:z.string(),read_at:z.string().nullable(),
}));
export default async function AccountNotifications() {
 const client=await sessionClient();
 const {data:auth}=await client.auth.getUser();
 if(!auth.user?.email_confirmed_at)redirect("/sign-in");
 const {data,error}=await client.rpc("my_account_notifications");
 const records=schema.safeParse(data);
 return <main className="shell stack"><p className="eyebrow">SNOOZER / ACCOUNT</p><h1>Account notifications</h1>
 <p className="muted">Important notices about Owner actions affecting your account. Notifications are available here without sending private moderation details in email.</p>
 {error||!records.success?<p role="alert">Notifications are unavailable.</p>:records.data.length===0?<p>No notifications yet.</p>:
 records.data.map(n=><div className="panel stack" key={n.id}>
 <h2>{n.title}{!n.read_at?" · New":""}</h2>
 <p>{n.body}</p><p className="muted">{new Date(n.created_at).toLocaleString("en-GB")}</p>
 {!n.read_at&&<form action={readNotification}><input type="hidden" name="id" value={n.id}/><button className="button small">Mark as read</button></form>}
 </div>)}
 <div className="actions"><Link href="/account/data">Your data requests</Link><Link href="/studio">Studio</Link></div>
 </main>;
}
