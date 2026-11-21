import { receivePremiumLiveWebhook } from "@/lib/premium-live-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return receivePremiumLiveWebhook(request);
}
