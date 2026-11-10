import { anonymousClient, storageAdmin } from "@/lib/supabase";

export async function GET() {
  let ready = false;
  try {
    const [lookup, images] = await Promise.all([
      anonymousClient().rpc("username_available", { p_name: "snoozer" }),
      storageAdmin().storage.getBucket("avatar-images"),
    ]);
    ready = !lookup.error && lookup.data === false && !images.error && images.data?.public === false;
  } catch {
    // Runtime misconfiguration and upstream failures share the same public response.
  }
  return Response.json({ status: ready ? "ready" : "unavailable" }, {
    status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" },
  });
}
