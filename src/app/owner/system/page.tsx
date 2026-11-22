import Link from "next/link";
import {runOwnerNoticeDelivery,sendOwnerTestEmail} from "./actions";
import {mailReadiness} from "@/lib/owner/mail-readiness";
import {noticeDeliveryConfigured} from "@/lib/owner/notification-delivery";
import {providerStatuses} from "@/lib/owner/provider-status";
import {z} from "zod";
import {requireOwner} from "@/lib/owner/auth";
const schema=z.object({active_sessions:z.number(),verified_accounts:z.number(),new_accounts_24h:z.number(),
 active_restrictions:z.number(),open_cases:z.number(),latest_admin_action:z.string().nullable()});
export default async function OwnerSystem({searchParams}:{searchParams:Promise<{mail?:string;sent?:string;failed?:string;test?:string}>}) {
 const mailParams=await searchParams;
 const {client}=await requireOwner();
 const [{data,error},providers]=await Promise.all([client.rpc("owner_system_health"),providerStatuses()]);
 const result=schema.safeParse(data);
 const mail=mailReadiness();
 return <main className="stack"><h1>Platform operations</h1>
 <p className="muted">Private aggregate system state. Provider deployment and incident controls remain in Render and Supabase dashboards.</p>
 <div className="actions"><Link className="button" href="/studio/billing-diagnostics">Billing diagnostics</Link>
 <Link className="button" href="/owner/security">Owner MFA</Link></div>
 {error||!result.success?<p role="alert">System metrics unavailable.</p>:<div className="owner-metrics">
 {Object.entries(result.data).map(([key,value])=><div className="panel" key={key}><p className="muted">{key.replaceAll("_"," ")}</p>
 <strong>{typeof value==="number"?value.toLocaleString("en-GB"):value?new Date(value).toLocaleString("en-GB"):"—"}</strong></div>)}
 </div>}
 <section className="panel stack"><h2>Public provider incident status</h2>
 <p className="muted">Read-only information from the providers public status pages. This does not establish the health of Snoozer-specific Render service, Supabase database or Stripe account.</p>
 <div className="owner-metrics">
 {providers.map(p=><div className="panel stack" key={p.provider}><h3><a href={p.url} target="_blank" rel="noopener noreferrer">{p.provider} status</a></h3>
 <p><strong>{p.indicator==="none"?"Operational (public status)":p.indicator==="unknown"?"Unavailable":p.indicator}</strong></p>
 <p>{p.description}</p><p className="muted">{p.checked_at?"Checked "+new Date(p.checked_at).toLocaleTimeString("en-GB"):"Verify on provider status site"}</p>
 </div>)}</div></section>
 <section className="panel stack"><h2>Transactional Owner notices</h2>
 <p>Account actions create in-app notices and queue their delivery through Zoho Mail. SMTP requires a valid Zoho mailbox, verified sender and an outbound SMTP-enabled hosting environment. A dispatcher sends eligible queued notices; it does not create a new test email.</p>
 <p role="status">{!mail.credentialsConfigured?
 "Zoho email credentials are missing in Render. Configure Zoho HTTPS Mail API credentials or SMTP on a supported hosting plan. In-app notices still work.":
 mail.transport==="api"?
 "Zoho HTTPS Mail API is configured. A successful API response means accepted, not necessarily delivered to the inbox.":
 mail.transport==="smtp"?
 "Zoho SMTP is configured on an outbound-enabled hosting plan. Check recipient inbox delivery.":
 "Zoho SMTP credentials are present, but Render Free blocks SMTP ports 25, 465 and 587. Configure Zoho HTTPS Mail API OAuth credentials to send without upgrading Render, or move to an SMTP-enabled plan."}</p>
 {!mail.dispatchTokenConfigured&&<p role="alert">Automatic dispatch secret not configured. Configure OWNER_EMAIL_DISPATCH_TOKEN in Render (at least 32 characters).</p>}
 {mailParams.mail&&<p role="status">{mailParams.mail==="ok"&&mailParams.sent==="0"&&mailParams.failed==="0"?
 "Dispatch completed but did not process any eligible notices. No email was sent. A message might be in its retry or claim-lease window.":
 mailParams.mail==="ok"? "Dispatch processed notices. SMTP accepted "+(mailParams.sent??"0")+"; failed "+(mailParams.failed??"0")+". Confirm receipt with recipients.":
 mailParams.mail==="mfa-required"?"Verified Owner MFA (AAL2) is required.":
 mailParams.mail==="unconfigured"?"Dispatch unavailable: Zoho SMTP or dispatch secret is not configured.":
 "Dispatch unavailable. Check the service configuration and logs."}</p>}
 {mailParams.test&&<p role="status">{mailParams.test==="accepted"?
 "Zoho accepted the test message. Check the inbox of your verified Owner email; this is not proof of inbox delivery.":
 mailParams.test==="failed"?"Zoho did not accept the test message. No successful delivery has been verified.":
 mailParams.test==="mfa-required"?"Verified Owner MFA (AAL2) is required to send the test.":
 mailParams.test==="verified-email-required"?"A confirmed Owner account email is required for the test.":
 "Test email unavailable: configure Zoho HTTPS Mail API or an SMTP-enabled hosting plan."}</p>}
 <div className="actions">
  <form action={sendOwnerTestEmail}><button className="button" disabled={mail.transport==="none"}>Send test email to my verified Owner address</button></form>
  <form action={runOwnerNoticeDelivery}><button className="button" disabled={!noticeDeliveryConfigured()}>Send pending account notices (MFA required)</button></form>
 </div>
 <p className="muted">Both actions require verified Owner MFA. The test email goes only to your own confirmed account address and does not grant Premium or create a moderation case.</p>
 </section>
 <section className="panel stack"><h2>Operational safeguards</h2><p>Changes to production secrets, deployment configuration and Stripe account settings require separate provider access. This page never exposes credentials.</p></section>
 </main>;
}
