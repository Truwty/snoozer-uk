import {z} from "zod";
import {sessionClient} from "@/lib/supabase";
import {verifyMyMembership} from "@/lib/creator-membership-server";
const headers={"Cache-Control":"private, no-store","X-Robots-Tag":"noindex, nofollow","X-Content-Type-Options":"nosniff"};
const deny=(status:number)=>new Response(null,{status,headers});
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}) {
 const id=z.uuid().safeParse((await params).id);
 if(!id.success) return deny(404);
 try {
  const client=await sessionClient();
  const user=await client.auth.getUser();
  if(user.error&&(user.error.status===0||(user.error.status??0)>=500)) return deny(503);
  if(user.error||!user.data.user?.email_confirmed_at) return deny(404);
  const own=await client.rpc("owns_my_creator_membership",{p_id:id.data});
  if(own.error||typeof own.data!=="boolean") return deny(503);
  if(!own.data) return deny(404);
  const result=await verifyMyMembership(client,user.data.user.id,id.data);
  if(!result.active||result.record.buyerId!==user.data.user.id||result.record.id!==id.data) return deny(404);
  return Response.json({type:"sandbox_membership",id:result.record.id,title:result.record.title,benefits:result.record.benefits,
   verifiedPeriodEnd:result.record.periodEnd,note:"Sandbox only; not a real membership or Snoozer Plus entitlement."},{headers});
 } catch {return deny(503);}
}
