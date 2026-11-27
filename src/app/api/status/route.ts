import { getPublicStatusSnapshot } from "@/lib/status-snapshot";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getPublicStatusSnapshot();
  return Response.json(snapshot, {
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
