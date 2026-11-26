import Link from "next/link";
import { redirect } from "next/navigation";
import { sessionClient } from "@/lib/supabase";
import { safeNextPath } from "@/lib/account-security";
import { verifyLoginMfa } from "@/app/studio/account/actions";

export const metadata={title:"Verify your sign-in",robots:{index:false,follow:false}};
export const dynamic="force-dynamic";

export default async function VerifyMfa({searchParams}:{searchParams:Promise<{next?:string;failed?:string}>}){
 const params=await searchParams;
 const next=safeNextPath(params.next);
 const client=await sessionClient();
 const {data:user}=await client.auth.getUser();
 if(!user.user?.email_confirmed_at)redirect("/sign-in");
 const [assurance,factors]=await Promise.all([
  client.auth.mfa.getAuthenticatorAssuranceLevel(),client.auth.mfa.listFactors()
 ]);
 if(assurance.error||factors.error)throw new Error("Account security checks are unavailable.");
 if(assurance.data?.currentLevel==="aal2")redirect(next);
 const verified=factors.data?.totp?.filter(item=>item.status==="verified")??[];
 if(verified.length===0)redirect(next);
 return <main className="shell stack">
  <section className="panel stack" style={{maxWidth:"32rem",margin:"3rem auto"}}>
   <p className="eyebrow">ACCOUNT SECURITY</p><h1>Verify it’s you</h1>
   <p>Enter a six-digit authenticator code or a single-use recovery code to finish signing in to Snoozer.</p>
   {params.failed==="1"&&<p role="alert">That code was not accepted. Check your authenticator app and try again.</p>}
   {verified.map((factor,index)=><form key={factor.id} action={verifyLoginMfa} className="stack">
    <input type="hidden" name="factorId" value={factor.id}/>
    <input type="hidden" name="next" value={next}/>
    <label htmlFor={"mfa-code-"+index}>Authenticator or recovery code</label>
    <input id={"mfa-code-"+index} name="code" type="text" autoComplete="one-time-code" spellCheck={false}
      placeholder="123456 or XXXX-XXXX-XXXX-XXXX-XXXX" maxLength={24} required/>
    <button className="button primary" type="submit">Verify and continue</button>
   </form>)}
   <p className="muted">A recovery code restores sign-in only. You will need to register and verify a new authenticator before carrying out actions that require full multi-factor assurance.</p>
   <Link href="/sign-in">Back to sign in</Link>
  </section>
 </main>;
}
