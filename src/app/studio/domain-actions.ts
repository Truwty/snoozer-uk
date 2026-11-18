"use server";
import { domainToASCII } from "node:url";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/actions";
import { domainInventory, domainName } from "@/lib/domains";
import { domainProviderConfig, providerDomainRemoved } from "@/lib/domain-verification";
import { refreshDomain } from "@/lib/domains-server";
import { siteUrl } from "@/lib/env";
import { requireAccount } from "@/lib/profiles-server";
import { storageAdmin } from "@/lib/supabase";

export async function manageDomain(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z.object({ profile: z.uuid(), operation: z.enum(["request", "verify", "disconnect", "confirm-removal"]) }).safeParse({ profile: form.get("profile"), operation: form.get("operation") });
  if (!input.success) return { status: "error", message: "Invalid domain request. Reload Studio." };
  const { client, user } = await requireAccount();
  if (input.data.operation === "request") {
    const raw = String(form.get("hostname") ?? "").trim();
    const host = domainName.safeParse(raw.length <= 220 && !/[/:@?#\[\]\s]/.test(raw) ? domainToASCII(raw).toLowerCase().replace(/\.$/, "") : "");
    if (!host.success || host.data === siteUrl().hostname || host.data === "www." + siteUrl().hostname) return { status: "error", message: "Enter a public hostname without a URL, port or wildcard. Platform addresses cannot be connected." };
    const response = await client.rpc("request_profile_domain", { p_profile: input.data.profile, p_host: host.data });
    if (response.error) return { status: "error", message: response.error.code === "P1001" ? "Up to five new domain requests are allowed per UTC day." : "Couldn’t request this domain. Check your plan and profile ownership." };
    revalidatePath("/studio");
    return { status: "success", message: "Domain request saved. Add the ownership TXT record, then arrange connection approval. Your page remains on its current address." };
  }
  const requestId = z.uuid().safeParse(form.get("request"));
  if (!requestId.success) return { status: "error", message: "Choose a current domain request." };
  const inventory = await client.rpc("list_my_domains", { p_profile: input.data.profile });
  const parsed = domainInventory.safeParse(inventory.data);
  const item = parsed.success && parsed.data.items.find((entry) => entry.id === requestId.data);
  if (inventory.error || !item) return { status: "error", message: "Domain request unavailable. Reload Studio." };
  if (input.data.operation === "disconnect") {
    const response = await client.rpc("disconnect_profile_domain", { p_request: item.id });
    if (response.error) return { status: "error", message: "Couldn’t disconnect this domain. Try again." };
    revalidatePath("/studio");
    return { status: "success", message: ["active", "provisioning", "disconnecting"].includes(item.state) ? "Routing stopped. An operator must remove the Render association before removal can be confirmed." : "Pending request retired. Other domain connections are unchanged." };
  }
  const config = domainProviderConfig();
  if (!config) return { status: "error", message: "Domain verification is awaiting operator configuration. No provider changes were made." };
  if (input.data.operation === "confirm-removal") {
    if (item.state !== "disconnecting" || !await providerDomainRemoved(item.hostname, config)) return { status: "error", message: "Provider removal could not be confirmed. Ask the operator to remove this connection, then retry." };
    const result = await storageAdmin().rpc("complete_domain_disconnect", { p_host: item.hostname, p_request: item.id });
    if (result.error || result.data !== true) return { status: "error", message: "The domain state changed. Reload before confirming removal." };
    revalidatePath("/studio");
    return { status: "success", message: "Provider removal confirmed. This connection no longer prevents profile deletion." };
  }
  const status = await refreshDomain(item.hostname, { request: item.id, id: user.id });
  revalidatePath("/studio");
  return status === "verified" ? { status: "success", message: "DNS, provider association and HTTPS verified. Routing is enabled while this profile is published and its plan remains eligible." }
    : { status: "error", message: status === "busy" ? "A check is already running or was attempted recently. Retry after a minute." : "Domain verification could not be confirmed. Check the TXT record, approved Render connection and HTTPS readiness." };
}
