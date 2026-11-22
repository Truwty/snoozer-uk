import Link from "next/link";
import {redirect} from "next/navigation";
import {z} from "zod";
import {sessionClient} from "@/lib/supabase";
export const metadata={title:"Account restriction · Snoozer",robots:{index:false,follow:false}};
export const dynamic="force-dynamic";
const schema=z.object({kind:z.enum(["suspension","ban"]),reason:z.string(),ends_at:z.string().nullable(),
 appealable_cases:z.array(z.object({id:z.uuid(),category:z.string(),status:z.string()}))});
export default async function RestrictedAccount(){
 const client=await sessionClient();
 const {data:auth}=await client.auth.getUser();
 if(!auth.user?.email_confirmed_at)redirect("/sign-in");
 const {data,error}=await client.rpc("my_account_restriction");
 if(error)return <main className="shell stack"><h1>Account access</h1><p role="alert">We cannot currently verify your account restrictions. Contact support.</p></main>;
 const restriction=schema.safeParse(data);
 if(!restriction.success)redirect("/studio");
 const r=restriction.data;
 return <main className="shell stack" style={{paddingBottom:"4rem"}}>
 <h1>Account {r.kind==="ban"?"restricted":"temporarily suspended"}</h1>
 <section className="panel stack"><p>Your Snoozer account is currently restricted from Studio actions.</p>
 <p><strong>Reason:</strong> {r.reason}</p>
 {r.ends_at&&<p><strong>Restriction ends:</strong> {new Date(r.ends_at).toLocaleString("en-GB")}</p>}
 <p>Existing billing rights and statutory rights are not removed by this account restriction. Contact support for assistance.</p>
 </section>
 <div className="actions"><Link href="/account/data">Data access and deletion requests</Link><Link href="/account/notifications">Account notices</Link></div><h2>Moderation appeals</h2>
 {r.appealable_cases.length===0?<p>No appealable case is linked to this restriction. Contact support for a case reference.</p>:
 r.appealable_cases.map(c=><div className="panel stack" key={c.id}><p>{c.category} · {c.status}</p><p>Case reference: <code>{c.id}</code></p>
 <Link href="/appeal">Submit an appeal</Link></div>)}
 </main>;
}
