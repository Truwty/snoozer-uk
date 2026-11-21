import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  config: vi.fn(),
  refresh: vi.fn(),
  rpc: vi.fn(),
  notFound: vi.fn((): never => { throw new Error("NOT_FOUND"); }),
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/lib/creator-checkout", () => ({ creatorCheckoutConfig: mocks.config }));
vi.mock("@/lib/creator-store-server", () => ({ refreshCreatorStore: mocks.refresh }));
vi.mock("@/lib/supabase", () => ({ anonymousClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/components/shell", () => ({
  Brand: () => createElement("span", null, "Snoozer"),
}));
vi.mock("@/components/creator-buy-form", () => ({
  CreatorBuyForm: ({ versionId }: { versionId: string }) =>
    createElement("span", { "data-checkout-version": versionId }, "Test Checkout"),
}));
import Page, { metadata } from "../src/app/store/[username]/[versionId]/page";

const versionId = "00000000-0000-4000-8000-000000000001";
const otherVersion = "00000000-0000-4000-8000-000000000002";
const visible = {
  username: "creator-qa", displayName: "Sandbox Creator",
  items: [{
    versionId, title: "Synthetic PDF", description: "<script>inert</script>\nPrivate QA",
    amount: 50, currency: "gbp", bytes: 618,
  }],
};
const visit = (username = "creator-qa", id = versionId) => Page({
  params: Promise.resolve({ username, versionId: id }),
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.config.mockReturnValue({ enabled: true });
  mocks.refresh.mockResolvedValue(true);
  mocks.rpc.mockResolvedValue({ data: visible, error: null });
});

describe("creator sandbox product detail route", () => {
  it("shows only the validated reviewed store item and the existing purchase component", async () => {
    const html = renderToStaticMarkup(await visit());
    expect(html).toContain("Synthetic PDF");
    expect(html).toContain("£0.50 GBP");
    expect(html).toContain(`data-checkout-version="${versionId}"`);
    expect(html).toContain(`href="/store/creator-qa"`);
    expect(html).toContain("30 days");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;inert&lt;/script&gt;");
    expect(mocks.rpc).toHaveBeenCalledWith("get_creator_sandbox_store", {p_name:"creator-qa"});
    expect(mocks.refresh).toHaveBeenCalledWith("creator-qa", null);
  });
  it("prevents indexing of sandbox details", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
  it("does not query the store when the checkout configuration is disabled", async () => {
    mocks.config.mockReturnValueOnce(null);
    await expect(visit()).rejects.toThrow("NOT_FOUND");
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it("rejects invalid usernames and invalid UUIDs before any provider lookup", async () => {
    await expect(visit("..", versionId)).rejects.toThrow("NOT_FOUND");
    await expect(visit("creator-qa", "not-a-uuid")).rejects.toThrow("NOT_FOUND");
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it("does not expose unlisted, expired or withdrawn version IDs", async () => {
    await expect(visit("creator-qa", otherVersion)).rejects.toThrow("NOT_FOUND");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("does not expose products when the database returns no reviewed store", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(visit()).rejects.toThrow("NOT_FOUND");
  });
  it("does not disclose another store's product when a lookup returns a different owner", async () => {
    mocks.rpc.mockResolvedValueOnce({data:{...visible,username:"other-owner"},error:null});
    await expect(visit()).rejects.toThrow("NOT_FOUND");
  });
  it("fails closed when the store query errors", async () => {
    mocks.rpc.mockResolvedValueOnce({data:null,error:{code:"500"}});
    await expect(visit()).rejects.toThrow("temporarily unavailable");
  });
  it("fails closed rather than serving a stale product when readiness refresh throws", async () => {
    mocks.refresh.mockRejectedValueOnce(new Error("Provider offline"));
    await expect(visit()).rejects.toThrow("Provider offline");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
