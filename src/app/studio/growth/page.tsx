import Link from "next/link";
import { Brand } from "@/components/shell";
import { CopyLink } from "@/components/copy-link";
import { GrowthControls } from "@/components/growth-controls";
import { requireAccount } from "@/lib/profiles-server";
import { growthReport } from "@/lib/referrals";

export const metadata = { title: "Growth", robots: { index: false, follow: false } };
export default async function Page({ searchParams }: { searchParams: Promise<{ referral?: string }> }) {
  const { client } = await requireAccount();
  const response = await client.rpc("get_my_growth");
  const report = growthReport.safeParse(response.data);
  const unconfirmed = (await searchParams).referral === "unconfirmed";
  return <main className="shell stack">
    <header className="nav"><Brand /><Link className="button small" href="/studio">Back to Studio</Link></header>
    <section className="panel stack"><p className="eyebrow">STUDIO / GROWTH</p><h1>Growth</h1>
      <p>Share an optional referral link. No rewards or billing benefits are granted. These counts represent verified accounts, not unique people or proven incremental growth.</p>
      {unconfirmed && <p role="alert">Your email was verified. Referral credit could not be confirmed. Check your status and retry below if eligible.</p>}
      {response.error || !report.success ? <p role="alert">Growth reports are temporarily unavailable. Reload to try again.</p> : <>
        {report.data.enabled && report.data.code && <div className="stack"><Link href={`/sign-up?ref=${report.data.code}`}>Open your referral signup page</Link><CopyLink path={`/sign-up?ref=${report.data.code}`} label="Copy referral link" /></div>}
        {report.data.enabled && !report.data.canEnable && <p role="status">Your referral link is paused because you have no live profile. Publish a profile to accept new credit.</p>}
        <h2>Last 90 days</h2>
        <dl className="stack"><div><dt>Verified referred accounts</dt><dd>{report.data.verified}</dd></div>
          <div><dt>Accounts with a claimed profile</dt><dd>{report.data.claimed ?? "Available after five verified accounts"}</dd></div>
          <div><dt>Accounts with a live profile</dt><dd>{report.data.published ?? "Available after five verified accounts"}</dd></div></dl>
        <p className="muted">Profile stages show current status for accounts attributed in the last 90 days. Stages are hidden for smaller cohorts. Withdrawals and account deletion remove accounts from this report. No names, emails, payments or individual activity are shared. Connections are retained until withdrawal or account deletion; 90 days is the reporting window.</p>
        <GrowthControls enabled={report.data.enabled} canEnable={report.data.canEnable} attribution={report.data.attribution} />
      </>}
    </section>
  </main>;
}
