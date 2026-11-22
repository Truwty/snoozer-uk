import {submitAppeal} from "./actions";
export const metadata={title:"Appeal a moderation decision · Snoozer",robots:{index:false,follow:false}};
export default async function Appeal({searchParams}:{searchParams:Promise<{status?:string}>}) {
 const {status}=await searchParams;
 return <main className="shell stack" style={{paddingBottom:"4rem"}}>
  <h1>Appeal a moderation decision</h1><p className="muted">If your account has been restricted, you can still submit an appeal using your verified account. Include the case reference from your notice.</p>
  {status==="received"&&<p role="status">Appeal submitted. It will be reviewed.</p>}
  {status==="denied"&&<p role="alert">The appeal was rejected. Check the case reference, ownership and reporting limits.</p>}
  {status==="invalid"&&<p role="alert">Enter a valid case reference and details.</p>}
  <form action={submitAppeal} className="panel stack">
   <label>Case reference<input name="case" required placeholder="Case UUID" maxLength={36}/></label>
   <label>Appeal details<textarea name="reason" required minLength={15} maxLength={1000} rows={5}/></label>
   <button className="button" type="submit">Submit appeal</button>
  </form>
 </main>;
}
