import Link from "next/link";
import {z} from "zod";
import {requestExternalAppeal,submitExternalAppeal} from "./actions";
export const metadata={title:"Independent account appeal · Snoozer",robots:{index:false,follow:false}};
export const dynamic="force-dynamic";
export default async function ExternalAppeal({searchParams}:{searchParams:Promise<{token?:string;status?:string}>}){
 const params=await searchParams;
 const token=z.string().regex(/^[a-f0-9]{64}$/).safeParse(params.token);
 const configured=Boolean(process.env.BREVO_API_KEY&&process.env.SNOOZER_NOTIFICATION_FROM);
 return <main className="shell stack" style={{maxWidth:"48rem",paddingBottom:"4rem"}}>
  <p className="eyebrow">SNOOZER / INDEPENDENT APPEALS</p>
  <h1>Appeal without signing in</h1>
  <p>Accounts blocked from signing in can use this email-verification route. The link is sent only to the previously verified account email and expires after 15 minutes. Opening the link does not submit an appeal.</p>
  {params.status==="sent"&&<p role="status">If the case and email are eligible, a verification link has been requested. Check your inbox.</p>}
  {params.status==="received"&&<p role="status">Your appeal has been submitted for review.</p>}
  {params.status==="expired"&&<p role="alert">This link has expired, was used already, or the case is ineligible. Request another.</p>}
  {params.status==="invalid"&&<p role="alert">Check your details and try again.</p>}
  {(!configured||params.status==="unavailable")&&<p role="alert">Independent email appeals are not yet available. Contact snoozersupport@snoozer.uk for manual review.</p>}
  {token.success?<section className="panel stack"><h2>Submit verified appeal</h2>
   <form action={submitExternalAppeal} className="stack">
    <input type="hidden" name="token" value={token.data}/>
    <label>Reasons for review<textarea name="reason" required minLength={15} maxLength={1000} rows={6}/></label>
    <button className="button">Submit appeal</button>
   </form>
  </section>:configured?<section className="panel stack"><h2>Request verification link</h2>
   <form action={requestExternalAppeal} className="stack">
    <label>Moderation case reference<input name="case" placeholder="Case UUID" maxLength={36} required/></label>
    <label>Account email<input name="email" type="email" autoComplete="email" maxLength={254} required/></label>
    <button className="button">Email a verification link</button>
   </form>
  </section>:null}
  <p className="muted">We do not confirm whether an email or case exists. Never share passwords or verification links.</p>
  <Link href="/appeal">Regular appeals</Link>
 </main>;
}
