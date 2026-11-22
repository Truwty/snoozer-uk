import "server-only";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAccount } from "@/lib/profiles-server";

export const metadata = { title: "Owner Control Centre", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const overviewSchema = z.object({
  accounts: z.number().int().nonnegative(),
  profiles: z.number().int().nonnegative(),
  published: z.number().int().nonnegative(),
  owners: z.number().int().nonnegative(),
});
const profileSchema = z.array(z.object({
  username: z.string(),
  display_name: z.string(),
  published: z.boolean(),
  created_at: z.string(),
})).max(100);

export default async function OwnerPage() {
  const { client } = await requireAccount();
  const role = await client.rpc("is_platform_owner");
  // A normal account must never be able to discover or load owner-only data.
  if (role.error || role.data !== true) notFound();

  const [metrics, recent] = await Promise.all([
    client.rpc("owner_overview"),
    client.rpc("owner_recent_profiles", { p_limit: 40 }),
  ]);
  const summary = overviewSchema.safeParse(metrics.data);
  const profiles = profileSchema.safeParse(recent.data);

  return <main className="shell owner-console">
    <header className="stack">
      <p className="eyebrow">SNOOZER / PLATFORM ADMINISTRATION</p>
      <h1>Owner Control Centre <span className="profile-owner-badge">Owner</span></h1>
      <p className="muted">Authenticated platform administration. Only accounts recorded in the private Owner registry can access this page. All profile data below is read-only.</p>
      <div className="actions"><Link className="button small" href="/studio">Open Studio</Link><Link className="button small" href="/studio/plan">Plan and usage</Link><Link className="button small" href="/studio/billing-diagnostics">Billing diagnostics</Link></div>
    </header>
    {summary.success ? <section className="owner-metrics" aria-label="Platform overview">
      <div className="panel"><p className="muted">Registered accounts</p><strong>{summary.data.accounts.toLocaleString("en-GB")}</strong></div>
      <div className="panel"><p className="muted">Total profiles</p><strong>{summary.data.profiles.toLocaleString("en-GB")}</strong></div>
      <div className="panel"><p className="muted">Published profiles</p><strong>{summary.data.published.toLocaleString("en-GB")}</strong></div>
      <div className="panel"><p className="muted">Platform owners</p><strong>{summary.data.owners.toLocaleString("en-GB")}</strong></div>
    </section> : <p role="alert">Owner metrics are unavailable. Reload to retry.</p>}
    <section className="panel stack" aria-labelledby="owner-recent-heading">
      <h2 id="owner-recent-heading">Recent profiles</h2>
      <p className="muted">The 40 most recently created profiles. No private email addresses or authentication data is exposed.</p>
      {profiles.success ? profiles.data.length > 0
        ? <div className="owner-profiles-list"><table><thead><tr><th scope="col">Profile</th><th scope="col">Status</th><th scope="col">Created</th></tr></thead><tbody>
          {profiles.data.map((profile) => <tr key={profile.username}>
            <td><strong>{profile.display_name}</strong> <span className="muted">@{profile.username}</span>{profile.published && <> <Link href={`/${profile.username}`}>View</Link></>}</td>
            <td>{profile.published ? "Published" : "Draft"}</td>
            <td><time dateTime={profile.created_at}>{new Date(profile.created_at).toLocaleDateString("en-GB", { timeZone: "UTC", dateStyle: "medium" })}</time></td>
          </tr>)}
        </tbody></table></div>
        : <p>No profiles yet.</p> : <p role="alert">Profile inventory is temporarily unavailable.</p>}
    </section>
    <section className="panel stack">
      <h2>Owner permissions</h2>
      <p>Your account inherits the highest available Studio feature entitlements. Billing settings and other creators’ data are not automatically editable; privileged write actions require separately audited tools and explicit confirmation.</p>
    </section>
  </main>;
}
