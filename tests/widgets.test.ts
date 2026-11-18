import { describe, expect, it, vi } from "vitest";
import { metadataWidget, robloxPlace, twitchChannel } from "../src/lib/widgets";
import { fetchWidgetMetadata, WidgetBackoff } from "../src/lib/widget-provider";
import { receivePublicWidget } from "../src/lib/public-widget";

const origin = "https://snoozer.uk";
const lease = "00000000-0000-4000-8000-000000000011";
const data = { version: 1 as const, provider: "github" as const, resource: "example/repo", title: "Example/Repo",
  description: "Public repository", stats: [{ label: "Stars" as const, value: 7 }], fetchedAt: "2026-11-17T00:00:00Z" };
const json = (value: unknown, status = 200, headers = {}) =>
  new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json", ...headers } });
const request = (payload: unknown = { username: "creator", position: 1, provider: "github", consent: true }, from = origin) =>
  new Request(origin + "/api/v1/widgets/public", { method: "POST", body: JSON.stringify(payload),
    headers: { origin: from, "content-type": "application/json" } });

describe("allowlisted provider links", () => {
  it("recognises public resource URLs without forwarding arbitrary parameters", () => {
    expect(metadataWidget("https://github.com/Example/Repo.git?private=ignored")).toEqual({ provider: "github", resource: "example/repo" });
    expect(metadataWidget("https://discord.gg/ExampleCode")).toEqual({ provider: "discord", resource: "i:ExampleCode" });
    expect(metadataWidget("https://discord.com/channels/123456789012345678/987654321098765432")).toEqual({ provider: "discord", resource: "g:123456789012345678" });
    expect(twitchChannel("https://www.twitch.tv/TwitchDev")).toBe("twitchdev");
    expect(robloxPlace("https://www.roblox.com/games/1234567890/Game")).toBe("1234567890");
  });
  it.each(["https://github.com.evil.com/owner/repo", "https://user@github.com/owner/repo",
    "http://github.com/owner/repo", "https://github.com:444/owner/repo", "https://github.com/owner/../",
    "https://github.com/owner/repo/issues", "https://discord.com/channels/@me/123", "javascript:alert(1)"])(
    "leaves unsupported or deceptive URLs as ordinary links: %s", (url) => expect(metadataWidget(url)).toBeNull());
  it("does not turn Twitch directory pages or lookalike Roblox hosts into widgets", () => {
    expect(twitchChannel("https://twitch.tv/directory")).toBeNull();
    expect(twitchChannel("https://twitch.tv.evil.com/channel")).toBeNull();
    expect(robloxPlace("https://roblox.com.evil.com/games/123")).toBeNull();
  });
});

describe("provider data projection", () => {
  it("projects public GitHub counters without forwarding credentials, visitor headers or sensitive provider fields", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({
      full_name: "Example/Repo", private: false, description: "<script>not executed</script>",
      stargazers_count: 7, forks_count: 2, temp_clone_token: "never-store-this", owner: { email: "private@example.com" },
    }));
    const { metadata: result } = await fetchWidgetMetadata("github", "example/repo", fetcher);
    expect(result.stats).toEqual([{ label: "Stars", value: 7 }, { label: "Forks", value: 2 }]);
    expect(JSON.stringify(result)).not.toMatch(/never-store|private@example|temp_clone_token/);
    expect(fetcher).toHaveBeenCalledWith("https://api.github.com/repos/example/repo",
      expect.objectContaining({ redirect: "error", credentials: "omit" }));
    expect((fetcher.mock.calls[0][1]?.headers as Record<string, string>)).not.toHaveProperty("Authorization");
  });
  it("projects Discord counts without retaining member lists or invite metadata", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({
      code: "ExampleCode", guild: { name: "Community", description: null }, approximate_presence_count: 0,
      approximate_member_count: 10, inviter: { username: "never-store-this" },
    }));
    const { metadata: result } = await fetchWidgetMetadata("discord", "i:ExampleCode", fetcher);
    expect(result.stats).toEqual([{ label: "Online", value: 0 }, { label: "Members", value: 10 }]);
    expect(JSON.stringify(result)).not.toContain("never-store-this");
  });
  it("rejects mismatched, private, malformed and oversized responses", async () => {
    const fetcher = vi.fn<typeof fetch>();
    fetcher.mockResolvedValueOnce(json({ full_name: "other/repo", private: false, description: null, stargazers_count: 1, forks_count: 1 }));
    await expect(fetchWidgetMetadata("github", "example/repo", fetcher)).rejects.toThrow();
    fetcher.mockResolvedValueOnce(json({ full_name: "example/repo", private: true, description: null, stargazers_count: 1, forks_count: 1 }));
    await expect(fetchWidgetMetadata("github", "example/repo", fetcher)).rejects.toThrow();
    fetcher.mockResolvedValueOnce(json("x".repeat(100001)));
    await expect(fetchWidgetMetadata("github", "example/repo", fetcher)).rejects.toThrow(/large/);
    await expect(fetchWidgetMetadata("github", "../escape", fetcher)).rejects.toThrow(/Unsupported/);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("respects provider retry hints instead of fabricating a successful summary", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({}, 429, { "Retry-After": "120" }));
    await expect(fetchWidgetMetadata("github", "example/repo", fetcher)).rejects.toMatchObject({ seconds: 120 });
    fetcher.mockResolvedValue(json({ retry_after: 120.5 }, 429));
    await expect(fetchWidgetMetadata("discord", "i:ExampleCode", fetcher)).rejects.toMatchObject({ seconds: 121 });
  });
  it("blocks subsequent refreshes when a successful provider response exhausts its remaining allowance", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({
      full_name: "Example/Repo", private: false, description: null, stargazers_count: 0, forks_count: 0,
    }, 200, { "X-RateLimit-Remaining": "0", "X-RateLimit-Reset-After": "90" }));
    expect((await fetchWidgetMetadata("github", "example/repo", fetcher)).retryAfter).toBe(90);
  });
});

describe("public widget request boundary", () => {
  function dependencies() {
    return { getLink: vi.fn().mockResolvedValue("https://github.com/example/repo"),
      claim: vi.fn().mockResolvedValue({ state: "refresh", lease }),
      complete: vi.fn().mockResolvedValue(true), fetchMetadata: vi.fn().mockResolvedValue({ metadata: data, retryAfter: 0 }) };
  }
  it("rejects cross-profile requests on a creator host before reading links or fetching providers", async () => {
    const deps = dependencies();
    expect((await receivePublicWidget(request(), origin, deps, "another-creator")).status).toBe(403);
    expect(deps.getLink).not.toHaveBeenCalled();
    expect(deps.fetchMetadata).not.toHaveBeenCalled();
  });
  it("waits for cache persistence and serves cached public projections without another provider call", async () => {
    const deps = dependencies();
    expect((await receivePublicWidget(request(), origin, deps)).status).toBe(200);
    expect(deps.complete).toHaveBeenCalledWith("github", "example/repo", lease, data, 0);
    deps.claim.mockResolvedValue({ state: "cached", payload: data });
    const response = await receivePublicWidget(request(), origin, deps);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual(data);
    expect(deps.fetchMetadata).toHaveBeenCalledTimes(1);
  });
  it("rejects cross-origin, unconsented and caller-selected resource requests before any provider work", async () => {
    const deps = dependencies();
    expect((await receivePublicWidget(request(undefined, "https://evil.com"), origin, deps)).status).toBe(403);
    expect((await receivePublicWidget(request({ username: "creator", position: 1, provider: "github", consent: false }), origin, deps)).status).toBe(400);
    expect((await receivePublicWidget(request({ username: "creator", position: 1, provider: "github", consent: true, url: "http://internal/" }), origin, deps)).status).toBe(400);
    expect(deps.getLink).not.toHaveBeenCalled();
  });
  it("cannot reveal cached data after the published link is removed or replaced", async () => {
    const deps = dependencies();
    deps.getLink.mockResolvedValue(null);
    expect((await receivePublicWidget(request(), origin, deps)).status).toBe(404);
    deps.getLink.mockResolvedValue("https://discord.gg/ExampleCode");
    expect((await receivePublicWidget(request(), origin, deps)).status).toBe(400);
    expect(deps.claim).not.toHaveBeenCalled();
  });
  it("holds provider backoff and reports durable/pending failures without fake counters", async () => {
    const deps = dependencies();
    deps.fetchMetadata.mockRejectedValue(new WidgetBackoff(120));
    expect((await receivePublicWidget(request(), origin, deps)).status).toBe(503);
    expect(deps.complete).toHaveBeenCalledWith("github", "example/repo", lease, null, 120);
    deps.claim.mockResolvedValue({ state: "limited", retry_after: 60 });
    const limited = await receivePublicWidget(request(), origin, deps);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
  });
});
