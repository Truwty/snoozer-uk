import Link from "next/link";
import {redirect} from "next/navigation";
import {Brand} from "@/components/shell";
import {CreatorKofiHookForm} from "@/components/creator-kofi-hook-form";
import {creatorKofiReport,formatReportedAmount} from "@/lib/creator-kofi-reporting";
import {readStudioDraft,requireAccount,type StudioProfileQuery} from "@/lib/profiles-server";
import {siteUrl} from "@/lib/env";

export const metadata={title:"Creator Ko-fi notification reporting",robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<StudioProfileQuery>}) {
 const query=await searchParams;const draft=await readStudioDraft(query.profile);
 if(!draft) redirect("/studio");
 const {client}=await requireAccount();
 const response=await client.rpc("get_my_creator_kofi_reporting",{p_profile:draft.profile_id});
 const parsed=creatorKofiReport.safeParse(response.data);
 const url=new URL("/api/v1/commerce/kofi/webhook",siteUrl()).href;
 return <main className="shell stack">
  <header className="nav"><Brand/><Link href="/studio" className="button small">Back to Studio</Link></header>
  <section className="panel stack">
   <p className="eyebrow">STUDIO / CREATOR COMMERCE</p><h1>Ko-fi payment notifications</h1>
   <p>Opt-in external Ko-fi reporting for this profile only. These are provider-reported notifications, not independently verified transactions, refund-adjusted revenue, tax invoices, payouts or Snoozer entitlements. Ko-fi does not provide membership-ending events through this webhook. Only you can access these records.</p>
   <p>Ko-fi webhook URL for your account: <code style={{overflowWrap:"anywhere"}}>{url}</code></p>
   {response.error||!parsed.success?<p role="alert">Ko-fi notification reporting is temporarily unavailable.</p>:<>
    <CreatorKofiHookForm profile={draft.profile_id} revision={parsed.data.revision??0} enabled={parsed.data.enabled}/>
    <h2>Provider-reported totals, by original currency</h2>
    <p>Gross incoming notifications only. Different currencies are never converted or combined; refunds, chargebacks, fees and taxes are not reconciled.</p>
    {parsed.data.totals.length===0?<p>No notifications recorded.</p>:parsed.data.totals.map(t=><p key={t.currency}>{t.count} notification(s) · {formatReportedAmount(t.amountMinor,t.currency)} ({t.currency})</p>)}
    <h2>Most recent notifications</h2>
    {parsed.data.notifications.length===0?<p>No reported donation notifications yet.</p>:parsed.data.notifications.map(item=><article key={item.id} className="panel stack">
     <p>{formatReportedAmount(item.amountMinor,item.currency)} · <time dateTime={item.occurredAt}>{new Date(item.occurredAt).toUTCString()}</time></p>
     <p>External transaction reference: <code>{item.transactionId}</code></p>
    </article>)}
   </>}
  </section>
 </main>;
}
