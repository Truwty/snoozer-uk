import { buildCreatorQaPdf } from "../../../../../scripts/creator-commerce-qa-fixture.mjs";
import { sessionClient } from "@/lib/supabase";

const unavailable = (status: 404 | 503) => new Response(null, {
  status,
  headers: { "Cache-Control": "private, no-store" },
});

// This is a deterministic *synthetic* PDF, not an approved offer or a buyer file.
// Require a confirmed Studio account and deliver as an inert download.
export async function GET() {
  try {
    const client = await sessionClient();
    const session = await client.auth.getUser();
    if (session.error) return unavailable((session.error.status ?? 0) >= 500 || session.error.status === 0 ? 503 : 404);
    if (!session.data.user?.email_confirmed_at) return unavailable(404);
    const bytes = buildCreatorQaPdf();
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": 'attachment; filename="snoozer-isolated-sandbox-qa.pdf"',
        "Content-Length": String(bytes.length),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox; default-src 'none'",
      },
    });
  } catch {
    return unavailable(503);
  }
}
