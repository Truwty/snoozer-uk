import { z } from "zod";
import { analyticsCsv, dailyAnalytics } from "@/lib/analytics";
import { sessionClient } from "@/lib/supabase";

export async function GET(request: Request) {
  const profile = z.uuid().safeParse(new URL(request.url).searchParams.get("profile"));
  const headers = { "Cache-Control": "private, no-store" };
  if (!profile.success) return new Response(null, { status: 400, headers });
  try {
    const client = await sessionClient();
    const { data: account, error: authError } = await client.auth.getUser();
    if (authError && (authError.status === 0 || (authError.status ?? 0) >= 500)) return new Response(null, { status: 503, headers });
    if (!account.user?.email_confirmed_at) return new Response(null, { status: 401, headers });
    // get_draft returns null for profiles owned by another account.
    const draft = await client.rpc("get_draft", { p_profile: profile.data });
    if (draft.error) return new Response(null, { status: 503, headers });
    if (!draft.data) return new Response(null, { status: 404, headers });
    const response = await client.rpc("get_my_profile_view_days", { p_profile: profile.data });
    const rows = dailyAnalytics.safeParse(response.data);
    if (response.error || !rows.success) return new Response(null, { status: 503, headers });
    return new Response(analyticsCsv(rows.data), { headers: { ...headers,
      "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="snoozer-analytics.csv"',
      "X-Content-Type-Options": "nosniff",
    } });
  } catch { return new Response(null, { status: 503, headers }); }
}
