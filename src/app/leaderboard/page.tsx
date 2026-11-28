import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
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
  const podiumEntries = rows.slice(0, 3);
  const remainingEntries = rows.slice(3);
  const retryHref = period === "month" ? "/leaderboard?period=month" : "/leaderboard";

  return <main className="shell leaderboard-page">
    <SiteHeader />

    <header className="leaderboard-hero">
      <div className="leaderboard-hero-copy">
        <p className="eyebrow">SNOOZER COMMUNITY / RANKINGS</p>
        <h1 id="leaderboard-title">Views leaderboard</h1>
        <p>Discover the public profiles making the biggest impression across Snoozer.</p>
      </div>

      <div className="leaderboard-period-picker">
        <span className="leaderboard-field-label">RANKING PERIOD</span>
        <nav className="leaderboard-tabs" aria-label="Leaderboard period">
          <Link href="/leaderboard" aria-current={period === "all" ? "page" : undefined}>All Time Views</Link>
          <Link href="/leaderboard?period=month" aria-current={period === "month" ? "page" : undefined}>Monthly Top Views</Link>
        </nav>
      </div>
    </header>

    <div className="leaderboard-meta" aria-label="Leaderboard details">
      <div>
        <span>RANKED BY</span>
        <strong>Recorded profile views</strong>
      </div>
      <div>
        <span>POSITIONS</span>
        <strong>Top 50 profiles</strong>
      </div>
      <div>
        <span>PERIOD</span>
        <strong>{period === "month" ? "UTC calendar month" : "All-time"}</strong>
      </div>
    </div>

    <section
      className="leaderboard-results"
      data-leaderboard-state={unavailable ? "unavailable" : rows.length === 0 ? "empty" : "ranked"}
      aria-label={period === "month" ? "Monthly top 50 profiles" : "All-time top 50 profiles"}
    >
      {unavailable ? <div className="leaderboard-empty" role="alert">
        <span className="leaderboard-empty-mark" aria-hidden="true">!</span>
        <h2>Leaderboard unavailable</h2>
        <p>We couldn’t load the rankings just now. Your profile views have not been affected.</p>
        <Link href={retryHref}>Try again</Link>
      </div> : rows.length === 0 ? <div className="leaderboard-empty">
        <span className="leaderboard-empty-mark" aria-hidden="true">↗</span>
        <h2>No rankings yet</h2>
        <p>The first eligible profile views for this period will appear here. Published profiles need Views Leaderboard visibility enabled to be listed.</p>
      </div> : <>
        <section className="leaderboard-podium-section" aria-labelledby="leaderboard-podium-title">
          <div className="leaderboard-section-heading">
            <div>
              <p className="eyebrow">THE FRONT RUNNERS</p>
              <h2 id="leaderboard-podium-title">Top three</h2>
            </div>
            <span>Highest recorded views</span>
          </div>

          <ol className={"leaderboard-podium leaderboard-podium--count-" + podiumEntries.length}>
            {podiumEntries.map((entry, index) => <li
              className={"leaderboard-podium-card leaderboard-podium-card--" + (index + 1)}
              key={entry.username}
            >
              <Link href={"/" + entry.username} className="leaderboard-podium-link">
                <span className="leaderboard-podium-placement">{["1ST PLACE", "2ND PLACE", "3RD PLACE"][index]}</span>
                <span className="leaderboard-avatar leaderboard-podium-avatar">
                  {entry.avatar
                    // Already-resized public avatar route. No remote/untrusted image URLs.
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={"/media/avatar/" + entry.username + "/" + entry.avatar} alt="" width={72} height={72} />
                    : <span aria-hidden="true">{Array.from(entry.display_name)[0]?.toUpperCase()}</span>}
                </span>
                <span className="leaderboard-podium-person">
                  <strong>{entry.display_name}</strong>
                  <small>@{entry.username}</small>
                </span>
                <span className="leaderboard-podium-count">
                  <strong>{formatLeaderboardViews(entry.views)}</strong>
                  <small>views</small>
                </span>
              </Link>
            </li>)}
          </ol>
        </section>

        {remainingEntries.length > 0 && <section className="leaderboard-rankings" aria-labelledby="leaderboard-rankings-title">
          <header className="leaderboard-rankings-heading">
            <div>
              <p className="eyebrow">THE REST OF THE TOP 50</p>
              <h2 id="leaderboard-rankings-title">Rankings</h2>
            </div>
            <span>Places 4–{rows.length}</span>
          </header>

          <div className="leaderboard-table-scroll">
            <table className="leaderboard-table">
              <caption className="sr-only">Public profiles ranked from position 4 to {rows.length} by {period === "month" ? "this month's" : "all-time"} recorded views</caption>
              <thead><tr><th scope="col">Rank</th><th scope="col">Profile</th><th scope="col">Views</th></tr></thead>
              <tbody>{remainingEntries.map((entry, index) => <tr key={entry.username}>
                <th scope="row" className="leaderboard-rank">{index + 4}</th>
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
          </div>
        </section>}
      </>}
    </section>

    <details className="leaderboard-explainer">
      <summary>How views are counted</summary>
      <div>
        <p>Rankings use eligible analytics events, not unique people. A repeat visit can count again. Owner views and known bots are excluded.</p>
        <p>Monthly rankings follow the UTC calendar month. Only published profiles with Views Leaderboard visibility enabled appear. This preference is separate from Discover directory listing and search-engine indexing.</p>
        <p>All-time totals begin with historical daily views still retained when the leaderboard launched. Older history already removed by analytics retention cannot be reconstructed.</p>
      </div>
    </details>

    <footer className="leaderboard-footer"><Link href="/">Back to Snoozer</Link></footer>
  </main>;
}
