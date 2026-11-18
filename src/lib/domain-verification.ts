import { Resolver } from "node:dns/promises";
import { get } from "node:https";
import { z } from "zod";
import { boundedBody } from "./bounded-request";
import { domainChallenge, domainName, domainVerificationMarker, publicIPv4, renderApexAddress } from "./domains";

export function requestDomainMarker(host: string, address: string): Promise<boolean> {
  if (!domainName.safeParse(host).success || !publicIPv4(address)) return Promise.resolve(false);
  return new Promise((resolve) => {
    const request = get({ hostname: host, port: 443, servername: host, path: "/.well-known/snoozer-domain",
      family: 4, rejectUnauthorized: true, signal: AbortSignal.timeout(4000),
      lookup: (_host, _options, callback) => callback(null, address, 4),
      headers: { Accept: "text/plain", "User-Agent": "Snoozer-Domain-Verification/1.0" },
    }, (response) => {
      if (response.statusCode !== 200 || !response.headers["content-type"]?.startsWith("text/plain")) {
        response.destroy(); resolve(false); return;
      }
      let text = "";
      response.on("data", (chunk: Buffer) => {
        if (text.length + chunk.length > 1024) { response.destroy(); resolve(false); }
        else text += chunk.toString("utf8");
      });
      response.on("end", () => resolve(text === domainVerificationMarker));
      response.on("error", () => resolve(false));
    });
    request.on("error", () => resolve(false));
  });
}

export type DomainChecks = {
  txt: (host: string) => Promise<string[][]>;
  ipv4: (host: string) => Promise<string[]>;
  ipv6: (host: string) => Promise<string[]>;
  fetch: typeof fetch;
  marker: typeof requestDomainMarker;
};
const resolver = new Resolver({ timeout: 1500, tries: 1 });
const checks: DomainChecks = {
  txt: (host) => resolver.resolveTxt(host), ipv4: (host) => resolver.resolve4(host),
  async ipv6(host) {
    try { return await resolver.resolve6(host); }
    catch (error) { if (["ENODATA", "ENOTFOUND"].includes((error as NodeJS.ErrnoException).code ?? "")) return []; throw error; }
  }, fetch, marker: requestDomainMarker,
};

export function domainProviderConfig() {
  const key = process.env.RENDER_CUSTOM_DOMAINS_API_KEY ?? "";
  const serviceId = process.env.RENDER_SERVICE_ID ?? "";
  const serviceHost = process.env.RENDER_SERVICE_HOSTNAME ?? process.env.RENDER_EXTERNAL_HOSTNAME ?? "";
  return key.length >= 20 && key.length <= 512 && !/\s/.test(key) && /^srv-[a-z0-9]+$/.test(serviceId) && /^[a-z0-9-]+\.onrender\.com$/.test(serviceHost)
    ? { key, serviceId, serviceHost } : null;
}
export async function providerDomainRemoved(host: string, config: { key: string; serviceId: string }, fetcher: typeof fetch = fetch) {
  if (!domainName.safeParse(host).success || !/^srv-[a-z0-9]+$/.test(config.serviceId) || !config.key) return false;
  try {
    const response = await fetcher(`https://api.render.com/v1/services/${config.serviceId}/custom-domains/${encodeURIComponent(host)}`, {
      headers: { Authorization: "Bearer " + config.key, Accept: "application/json" }, redirect: "error", credentials: "omit", cache: "no-store", signal: AbortSignal.timeout(4000),
    });
    if (response.status !== 404) return false;
    // A hidden/unauthorised service can also return404; prove parent-service read access first.
    const service = await fetcher(`https://api.render.com/v1/services/${config.serviceId}`, {
      headers: { Authorization: "Bearer " + config.key, Accept: "application/json" }, redirect: "error", credentials: "omit", cache: "no-store", signal: AbortSignal.timeout(4000),
    });
    if (!service.ok || !service.headers.get("content-type")?.includes("json")) return false;
    const body = await boundedBody(service, 8192);
    return !!body && z.object({ id: z.literal(config.serviceId), type: z.literal("web_service") }).safeParse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body))).success;
  } catch { return false; }
}

// Provider association is read-only. This path never provisions or bills for a domain.
export async function verifyDomain(host: string, challenge: string, config: { key: string; serviceId: string; serviceHost: string }, dependencies: DomainChecks = checks): Promise<boolean> {
  if (!domainName.safeParse(host).success || !domainChallenge.safeParse(challenge).success
    || !/^srv-[a-z0-9]+$/.test(config.serviceId) || !/^[a-z0-9-]+\.onrender\.com$/.test(config.serviceHost)
    || config.key.length < 20 || config.key.length > 512 || /\s/.test(config.key)) return false;
  try {
    const txt = await dependencies.txt("_snoozer." + host);
    if (txt.length > 20 || !txt.some((parts) => parts.join("") === challenge)) return false;
    const response = await dependencies.fetch(`https://api.render.com/v1/services/${config.serviceId}/custom-domains/${encodeURIComponent(host)}`, {
      headers: { Authorization: "Bearer " + config.key, Accept: "application/json" },
      redirect: "error", credentials: "omit", cache: "no-store", signal: AbortSignal.timeout(4000),
    });
    if (!response.ok || !response.headers.get("content-type")?.includes("json")) return false;
    const body = await boundedBody(response, 8192);
    if (!body) return false;
    const domain = z.object({ name: z.literal(host), verificationStatus: z.literal("verified") }).safeParse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)));
    if (!domain.success) return false;
    const [addresses, edge, ipv6] = await Promise.all([dependencies.ipv4(host), dependencies.ipv4(config.serviceHost), dependencies.ipv6(host)]);
    if (addresses.length > 20 || edge.length > 20 || ipv6.length) return false;
    if (!addresses.length || !addresses.every((value) => publicIPv4(value) && (edge.includes(value) || value === renderApexAddress))) return false;
    return await dependencies.marker(host, addresses[0]);
  } catch { return false; }
}
