import "server-only";
import { z } from "zod";
import { storageAdmin } from "./supabase";
import { domainProviderConfig, verifyDomain } from "./domain-verification";

const checkJob = z.discriminatedUnion("state", [
  z.object({ state: z.enum(["busy", "unavailable"]) }),
  z.object({ state: z.literal("check"), id: z.uuid(), hostname: z.string(), challenge: z.string(), lease: z.uuid() }),
]);
export async function refreshDomain(host: string, owner?: { request: string; id: string }) {
  const config = domainProviderConfig();
  if (!config) return "unconfigured";
  try {
    const client = storageAdmin();
    const claimed = await client.rpc("claim_domain_check", { p_host: host, ...(owner && { p_request: owner.request, p_actor: owner.id }) });
    const job = checkJob.safeParse(claimed.data);
    if (claimed.error || !job.success) return "unavailable";
    if (job.data.state !== "check") return job.data.state;
    const ok = await verifyDomain(job.data.hostname, job.data.challenge, config);
    const completed = await client.rpc("complete_domain_check", { p_request: job.data.id, p_lease: job.data.lease, p_ok: ok });
    return !completed.error && completed.data === true ? "verified" : "unverified";
  } catch { return "unavailable"; }
}
