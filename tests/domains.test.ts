import { expect, it, vi } from "vitest";
import { publicDomainContext, domainHostHeader, domainUserHeader } from "../src/lib/domain-context";
import { domainName, domainRoute, publicIPv4 } from "../src/lib/domains";
import { verifyDomain, providerDomainRemoved, requestDomainMarker, type DomainChecks } from "../src/lib/domain-verification";

const host = "creator.example.com";
const token = "snoozer-domain=00000000-0000-4000-8000-000000000001";
const config = { key: "x".repeat(32), serviceId: "srv-example", serviceHost: "snoozer-staging.onrender.com" };
function checks(): DomainChecks {
  return { txt: vi.fn(async () => [[token]]), ipv4: vi.fn(async () => ["216.24.57.1"]), ipv6: vi.fn(async () => []),
    fetch: vi.fn(async () => Response.json({ name: host, verificationStatus: "verified" })) as typeof fetch,
    marker: vi.fn(async () => true) };
}
it("requires fresh DNS proof, exact service association and TLS/application proof pinned to the Render edge", async () => {
  const dependencies = checks();
  expect(await verifyDomain(host, token, config, dependencies)).toBe(true);
  expect(dependencies.fetch).toHaveBeenCalledWith("https://api.render.com/v1/services/srv-example/custom-domains/creator.example.com", expect.objectContaining({ redirect: "error", credentials: "omit" }));
  expect(dependencies.marker).toHaveBeenCalledWith(host, "216.24.57.1");
  dependencies.txt = async () => [["a different challenge"]];
  expect(await verifyDomain(host, token, config, dependencies)).toBe(false);
});
it("fails closed for redirects, foreign/unverified association, DNS rebinding, IPv6 and failed TLS", async () => {
  for (const change of [
    { fetch: async () => new Response(null, { status: 302 }) },
    { fetch: async () => Response.json({ name: "other.example.com", verificationStatus: "verified" }) },
    { fetch: async () => Response.json({ name: host, verificationStatus: "unverified" }) },
    { ipv4: async (name: string) => [name === host ? "127.0.0.1" : "216.24.57.1"] },
    { ipv6: async () => ["::1"] }, { marker: async () => false },
    { fetch: async () => new Response("x".repeat(8193), { headers: { "content-type": "application/json" } }) },
  ]) expect(await verifyDomain(host, token, config, { ...checks(), ...change } as DomainChecks)).toBe(false);
  expect(await requestDomainMarker(host, "127.0.0.1")).toBe(false);
});
it("bounds host input, routable paths and public IPv4 targets", () => {
  expect(domainName.safeParse(host).success).toBe(true);
  for (const name of ["https://example.com", "example.com:443", "localhost", "127.0.0.1", "host.internal", "site.onrender.com", "x.supabase.co", "*.example.com", "A.example.com", "x".repeat(64)+".com"]) expect(domainName.safeParse(name).success).toBe(false);
  for (const address of ["0.0.0.0", "10.0.0.1", "127.0.0.1", "100.64.0.1", "169.254.1.1", "172.31.2.1", "192.168.1.1", "198.18.0.1", "224.0.0.1", "012.1.1.1", "999.1.1.1", "::1"]) expect(publicIPv4(address)).toBe(false);
  expect(domainRoute("/", "GET", "creator")).toBe(true);
  expect(domainRoute("/api/v1/analytics/view", "POST", "creator")).toBe(true);
  expect(domainRoute("/api/v1/spotify/now-playing", "GET", "creator")).toBe(false);
  expect(domainRoute("/api/v1/discord/presence", "GET", "creator")).toBe(true);
  expect(domainRoute("/api/v1/discord/presence", "POST", "creator")).toBe(false);
  expect(domainRoute("/api/v1/spotify/connect", "GET", "creator")).toBe(false);
  for (const path of ["/studio", "/sign-in", "/api/v1/billing/stripe/webhook", "/media/avatar/another/00000000-0000-4000-8000-000000000001"]) expect(domainRoute(path, "GET", "creator")).toBe(false);
  expect(domainRoute("/", "POST", "creator")).toBe(false);
});

it("recognises only matching custom-host context and confirms removal only from provider404", async () => {
  const headers = { [domainHostHeader]: host, [domainUserHeader]: "creator" };
  expect(publicDomainContext(new Request("https://"+host+"/", { headers }), "https://snoozer.uk")).toEqual({ host, username: "creator" });
  expect(publicDomainContext(new Request("https://snoozer.uk/", { headers }), "https://snoozer.uk")).toBeNull();
  expect(publicDomainContext(new Request("http://localhost:3000/api/v1/analytics/view", { headers: { ...headers, host } }), "https://snoozer.uk")).toEqual({ host, username: "creator" });
  expect(publicDomainContext(new Request("https://"+host+"/", { headers: { ...headers, host: "snoozer.uk" } }), "https://snoozer.uk")).toBeNull();
  expect(publicDomainContext(new Request("https://"+host+"/", { headers: { ...headers, [domainUserHeader]: "<script>" } }), "https://snoozer.uk")).toBeNull();
  for (const status of [200, 401, 403, 429, 500]) expect(await providerDomainRemoved(host, config, vi.fn(async () => new Response(null, { status })))).toBe(false);
  expect(await providerDomainRemoved(host, config, vi.fn(async () => new Response(null, { status: 404 })))).toBe(false);
  const removed = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(null, { status: 404 })).mockResolvedValueOnce(Response.json({ id: config.serviceId, type: "web_service" }));
  expect(await providerDomainRemoved(host, config, removed)).toBe(true);
});
