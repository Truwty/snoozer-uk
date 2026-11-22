import {notFound} from "next/navigation";
import Link from "next/link";
import {username as usernameSchema} from "@/lib/profile";
import {submitReport} from "./actions";
export const metadata={title:"Report a profile · Snoozer",robots:{index:false,follow:false}};
export default async function Report({params,searchParams}:{params:Promise<{username:string}>,searchParams:Promise<{status?:string}>}) {
 const name=(await params).username,status=(await searchParams).status;
 if(!usernameSchema.safeParse(name).success)notFound();
 return <main className="shell stack" style={{paddingBottom:"4rem"}}>
  <p><Link href={"/"+name}>← Back to profile</Link></p><h1>Report @{name}</h1>
  <p className="muted">Sign in with a verified account to submit a report. Three reports per 24 hours maximum. Provide accurate, relevant details.</p>
  {status==="received"&&<p role="status">Report submitted. Thank you for helping keep Snoozer safe.</p>}
  {status==="denied"&&<p role="alert">Report could not be submitted. Check your account and reporting limit.</p>}
  {status==="invalid"&&<p role="alert">Select a category and enter 15–1,000 characters.</p>}
  <form action={submitReport} className="panel stack"><input type="hidden" name="username" value={name}/>
   <label>Reason<select name="category" defaultValue="spam"><option value="spam">Spam</option><option value="phishing">Phishing or scam</option>
   <option value="impersonation">Impersonation</option><option value="harassment">Harassment</option><option value="malware">Malware</option>
   <option value="copyright">Copyright</option><option value="other">Other</option></select></label>
   <label>Details<textarea name="reason" required minLength={15} maxLength={1000} rows={5} placeholder="Describe what happened. Do not include passwords or private information."/></label>
   <button className="button" type="submit">Submit report</button>
  </form></main>;
}
