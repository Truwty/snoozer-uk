import { checkServiceReadiness } from "@/lib/health/readiness";

export async function GET() {
  const ready = await checkServiceReadiness();

  return Response.json({ status: ready ? "ready" : "unavailable" }, {
    status: ready ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
