import Link from "next/link";
import { Brand } from "@/components/shell";
import { supabaseKey, supabaseUrl } from "@/lib/env";
import { anonymousClient } from "@/lib/supabase";
import { leaderboardEntries, formatLeaderboardViews } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Views Leaderboard",
  description: "Discover the top 50 public Snoozer profiles by all-time and monthly recorded views.",
};

type Period = "all" | "month";

export default async function Page({ searchParams }: {
  searchParams: Promise<{ period?: string | string[] }>;
}) {
  const { period: requested } = await searchParams;
  const period: Period = requested === "month" ? "month" : "all";
  const response = supabaseUrl && supabaseKey
    ? await anonymousClient().rpc("get_views_leaderboard", { p_period: period })
    : null;
  const parsed = leaderboardEntries.safeParse(response?.data);
  const unavailable = !response || !!response.error || !parsed.success;
  const rows = !unavailable && parsed.success ? parsed.data : [];

  return <main className="shell leaderboard-page">
    <header className="nav">
      <Brand />
      <nav className="actions" aria-label="Leaderboard navigation">
        <Link href="/" className="button small">Home</Link>
        <Link href="/sign-up" className="button small">Create your page</Link>
      </nav>
    </header>

    <section className="leaderboard-hero" aria-labelledby="leaderboard-title">
      <p className="eyebrow">SNOOZER COMMUNITY</p>
      <h1 id="leaderboard-title">Views Leaderboard</h1>
      <p>Top 50 published profiles by {period === "month" ? "views this month" : "recorded views"}.</p>
      <nav className="leaderboard-tabs" aria-label="Leaderboard period">
        <Link href="/leaderboard" aria-current={period === "all" ? "page" : undefined}>All Time Views</Link>
        <Link href="/leaderboard?period=month" aria-current={period === "month" ? "page" : undefined}>Monthly Top Views</Link>
      </nav>
    </section>

    <section className="leaderboard-results" aria-label={period === "month" ? "Monthly top 50 profiles" : "All-time top 50 profiles"}>
      {unavailable ? <div className="leaderboard-empty" role="alert">
        The leaderboard is temporarily unavailable. Please try again later.
      </div> : rows.length === 0 ? <div className="leaderboard-empty">
        No recorded views in this period yet. The first published profiles with eligible views will appear here.
      </div> : <div className="leaderboard-table-scroll">
        <table className="leaderboard-table">
          <caption className="sr-only">Top {rows.length} public profiles by {period === "month" ? "this month's" : "all-time"} recorded views</caption>
          <thead><tr><th scope="col">#</th><th scope="col">Profile</th><th scope="col">Views</th></tr></thead>
          <tbody>{rows.map((entry, index) => <tr key={entry.username} data-rank={index + 1}>
            <th scope="row" className="leaderboard-rank">{index + 1}</th>
            <td>
              <Link className="leaderboard-person" href={"/" + entry.username}>
                <span className="leaderboard-avatar">
                  {entry.avatar
                    // Already-resized public avatar route. No remote/untrusted image URLs.
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={"/media/avatar/" + entry.username + "/" + entry.avatar} alt="" width={44} height={44} />
                    : <span aria-hidden="true">{Array.from(entry.display_name)[0]?.toUpperCase()}</span>}
                </span>
                <span className="leaderboard-person-info">
                  <strong>{entry.display_name}</strong>
                  <small>@{entry.username}</small>
                </span>
              </Link>
            </td>
            <td className="leaderboard-count">{formatLeaderboardViews(entry.views)}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>

    <p className="leaderboard-note">
      Views are consented events, not unique people. Owner views and known bots are excluded.
      The monthly leaderboard resets each UTC calendar month. All-time figures include the
      daily analytics still retained when this leaderboard launched, plus new views afterwards;
      older purged history cannot be recovered. Profiles that opt out of discovery are not listed.
    </p>
    <footer className="leaderboard-footer"><Link href="/">Back to Snoozer</Link></footer>
  </main>;
}
