import "server-only";

import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { headers } from "next/headers";
import { storageAdmin } from "@/lib/supabase";

/**
 * The raw network address never leaves this process. Only a keyed HMAC is
 * sent to the private discovery RPC, where the short-lived minute counter is
 * retained for abuse prevention.
 */
export async function discoveryRequestFingerprint() {
  const requestHeaders = await headers();
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Discovery service is not configured.");

  const candidates = [
    requestHeaders.get("x-real-ip"),
    requestHeaders.get("cf-connecting-ip"),
    ...(requestHeaders.get("x-forwarded-for") ?? "").split(","),
  ];
  const address = candidates
    .map((value) => value?.trim() ?? "")
    .find((value) => value && isIP(value));
  // A missing trusted network address falls back to one shared bucket rather
  // than allowing callers to bypass the database limiter.
  const identity = address ?? "unknown";
  return createHmac("sha256", secret).update(identity).digest("hex");
}

export async function discoveryServerClient() {
  return storageAdmin();
}
