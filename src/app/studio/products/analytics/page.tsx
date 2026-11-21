import Link from "next/link";
import { Brand } from "@/components/shell";
import { formatTestPence, creatorStorefrontAnalytics } from "@/lib/creator-storefront-analytics";
import { readStudioDraft, requireAccount, studioHref, type StudioProfileQuery } from "@/lib/profiles-server";

export const metadata = {
  title: "Creator test-store analytics",
  robots: { index: false, follow: false },
};

export default async function Page({ searchParams }: { searchParams: Promise<StudioProfileQuery> }) {
  const { profile } = await searchParams;
  const draft = await readStudioDraft(profile);
  const {client} = await requireAccount();
  const response = draft ? await client.rpc("read_my_creator_storefront_analytics",{p_profile:draft.profile_id}) : null;
  const report = creatorStorefrontAnalytics.safeParse(response?.data);

  return <main className="shell stack">
    <header className="nav"><Brand /><Link href={studioHref("/studio/products",draft?.profile_id)} className="button small">Back to products</Link></header>
    <section className="panel stack">
      <p className="eyebrow">STUDIO / CREATOR TEST COMMERCE</p>
      <h1>Sandbox storefront analytics</h1>
      <p>Private test-mode statistics for your own profile. These are aggregates of retained orders, not live sales, merchant earnings, payouts, net revenue, tax records or verified refunds. The 14-day chart groups orders by creation date in UTC, not payment or refund date.</p>
      {!draft ? <p>Claim a profile in Studio to view creator storefront analytics.</p>
        : response?.error || !report.success ? <p role="alert">Creator test-store analytics are temporarily unavailable. No payment or store configuration was changed. Reload later or contact support.</p>
        : <>
          <p>Profile: <strong>{draft.username}</strong>. History is limited by the existing sandbox retention policy; old records may have been purged. Existing paid downloads and risk holds remain governed by Stripe and the server.</p>
          <dl>
            <div><dt>Retained Checkout attempts</dt><dd>{report.data.retainedOrders}</dd></div>
            <div><dt>Pending test orders</dt><dd>{report.data.pendingOrders}</dd></div>
            <div><dt>Expired test orders</dt><dd>{report.data.expiredOrders}</dd></div>
            <div><dt>Verified paid test orders</dt><dd>{report.data.paidOrders}</dd></div>
            <div><dt>Paid orders held for risk review</dt><dd>{report.data.heldPaidOrders}</dd></div>
            <div><dt>Paid orders currently eligible for download</dt><dd>{report.data.downloadableOrders}</dd></div>
            <div><dt>Gross test Checkout amount (before refunds or disputes)</dt><dd>{formatTestPence(report.data.grossTestPence)}</dd></div>
          </dl>
          <section className="stack">
            <h2>Last 14 days (UTC)</h2>
            <div style={{overflowX:"auto"}}>
              <table>
                <thead><tr><th scope="col">Date</th><th scope="col">Orders created</th><th scope="col">Currently paid</th><th scope="col">Gross test amount</th></tr></thead>
                <tbody>{report.data.days.map(day=><tr key={day.day}>
                  <th scope="row">{day.day}</th>
                  <td>{day.orders}</td><td>{day.paid}</td><td>{formatTestPence(day.grossTestPence)}</td>
                </tr>)}</tbody>
              </table>
            </div>
          </section>
          {report.data.retainedOrders===0 && <p>No retained test purchases for this profile. No sample sales are fabricated.</p>}
        </>}
    </section>
  </main>;
}
