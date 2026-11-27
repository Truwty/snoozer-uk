export type PublicIncident = {
  state: "investigating" | "resolved";
  startedAt: string;
  resolvedAt: string | null;
};

export type PublicIncidentFeed = {
  available: boolean;
  incidents: PublicIncident[];
};

type GithubIssue = {
  title?: unknown;
  state?: unknown;
  created_at?: unknown;
  closed_at?: unknown;
  pull_request?: unknown;
};

function validTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return null;
  return value;
}

/**
 * The hourly production-health workflow creates one public issue while probes
 * are failing and closes it after recovery. Only lifecycle timestamps are
 * exposed here; issue bodies, comments and run diagnostics are never copied.
 */
export async function recentProductionIncidents(): Promise<PublicIncidentFeed> {
  try {
    const response = await fetch(
      "https://api.github.com/repos/Truwty/snoozer-uk/issues?state=all&per_page=100&sort=created&direction=desc",
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "Snoozer-public-status",
        },
        signal: AbortSignal.timeout(4000),
        next: { revalidate: 60 },
      },
    );

    if (!response.ok) return { available: false, incidents: [] };
    const raw: unknown = await response.json();
    if (!Array.isArray(raw)) return { available: false, incidents: [] };

    const incidents = raw
      .filter((issue: GithubIssue) => issue.title === "Snoozer production health alert" && issue.pull_request === undefined)
      .map((issue: GithubIssue): PublicIncident | null => {
        const startedAt = validTimestamp(issue.created_at);
        if (!startedAt) return null;

        const resolvedAt = validTimestamp(issue.closed_at);
        return {
          state: issue.state === "closed" && resolvedAt ? "resolved" : "investigating",
          startedAt,
          resolvedAt,
        };
      })
      .filter((incident: PublicIncident | null): incident is PublicIncident => incident !== null)
      .slice(0, 5);

    return { available: true, incidents };
  } catch {
    return { available: false, incidents: [] };
  }
}
