import { z } from "zod";
import { analyticsCsv, dailyAnalytics, linkAnalytics, linkAnalyticsCsv, trafficAnalytics, trafficAnalyticsCsv, browserAnalytics, browserAnalyticsCsv } from "@/lib/analytics";
import { sessionClient } from "@/lib/supabase";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const profile = z.uuid().safeParse(query.get("profile"));
  const breakdown = query.get("breakdown") ?? "days";
  const headers = { "Cache-Control": "private, no-store" };
  if (!profile.success || !["days", "links", "traffic", "browsers"].includes(breakdown)) return new Response(null, { status: 400, headers });
  try {
    const client = await sessionClient();
    const { data: account, error: authError } = await client.auth.getUser();
    if (authError && (authError.status === 0 || (authError.status ?? 0) >= 500)) return new Response(null, { status: 503, headers });
    if (!account.user?.email_confirmed_at) return new Response(null, { status: 401, headers });
    // get_draft returns null for profiles owned by another account.
    const draft = await client.rpc("get_draft", { p_profile: profile.data });
    if (draft.error) return new Response(null, { status: 503, headers });
    if (!draft.data) return new Response(null, { status: 404, headers });
    const response = await client.rpc(breakdown === "links" ? "get_my_profile_link_totals"
      : breakdown === "traffic" ? "get_my_profile_traffic_totals" : breakdown === "browsers" ? "get_my_profile_browser_days" : "get_my_profile_view_days", { p_profile: profile.data });
    if (response.error) return new Response(null, { status: 503, headers });
    const days = dailyAnalytics.safeParse(response.data);
    const links = linkAnalytics.safeParse(response.data);
    const traffic = trafficAnalytics.safeParse(response.data);
    const browsers = browserAnalytics.safeParse(response.data);
    const csv = breakdown === "browsers" ? browsers.success ? browserAnalyticsCsv(browsers.data) : null
      : breakdown === "traffic" ? traffic.success ? trafficAnalyticsCsv(traffic.data) : null
      : breakdown === "links" ? links.success ? linkAnalyticsCsv(links.data) : null
      : days.success ? analyticsCsv(days.data) : null;
    if (csv === null) return new Response(null, { status: 503, headers });
    return new Response(csv, { headers: { ...headers,
      "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": breakdown === "links"
        ? 'attachment; filename="snoozer-link-analytics.csv"' : breakdown === "traffic"
          ? 'attachment; filename="snoozer-traffic-analytics.csv"' : breakdown === "browsers"
            ? 'attachment; filename="snoozer-browser-analytics.csv"' : 'attachment; filename="snoozer-analytics.csv"',
      "X-Content-Type-Options": "nosniff",
    } });
  } catch { return new Response(null, { status: 503, headers }); }
}
