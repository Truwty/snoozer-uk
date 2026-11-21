import { beforeEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { GET } from "../src/app/studio/products/qa-fixture/route";
import { buildCreatorQaPdf, qaPdfSha256 } from "../scripts/creator-commerce-qa-fixture.mjs";
import { creatorOfferStatus, creatorQaDraft, creatorDiscountQaDraft } from "../src/lib/creator-qa-studio";
import { productPrice, productDescription, productTitle } from "../src/lib/products";

const mocks = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock("@/lib/supabase", () => ({
  sessionClient: async () => ({ auth: { getUser: mocks.getUser } }),
}));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { email_confirmed_at: "2026-11-19T00:00:00Z" } }, error: null });
});

it("delivers the existing exact deterministic synthetic PDF only to confirmed Studio users", async () => {
  const response = await GET();
  expect(response.status).toBe(200);
  const actual = Buffer.from(await response.arrayBuffer());
  const expected = buildCreatorQaPdf();
  expect(actual).toEqual(expected);
  expect(createHash("sha256").update(actual).digest("hex")).toBe(createHash("sha256").update(expected).digest("hex"));
  expect(qaPdfSha256(expected)).toBe(createHash("sha256").update(actual).digest("hex"));
  expect(qaPdfSha256()).toBe(qaPdfSha256(actual));
  expect(response.headers.get("content-type")).toBe("application/octet-stream");
  expect(response.headers.get("content-disposition")).toContain('attachment; filename="snoozer-isolated-sandbox-qa.pdf"');
  expect(response.headers.get("content-length")).toBe(String(actual.byteLength));
  expect(response.headers.get("content-security-policy")).toContain("sandbox");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
it("never serves QA fixture bytes to anonymous or unconfirmed accounts", async () => {
  for (const user of [null, {}, { email_confirmed_at: null }]) {
    mocks.getUser.mockResolvedValueOnce({ data: { user }, error: null });
    const response = await GET();
    expect(response.status).toBe(404);
    expect(await response.arrayBuffer()).toHaveProperty("byteLength", 0);
  }
});
it("fails closed on auth errors without sending fixture bytes", async () => {
  mocks.getUser.mockResolvedValueOnce({data:{user:null},error:{status:500}});
  const unavailable = await GET();
  expect(unavailable.status).toBe(503);
  expect(unavailable.headers.get("cache-control")).toBe("private, no-store");
  mocks.getUser.mockRejectedValueOnce(new Error("Offline"));
  expect((await GET()).status).toBe(503);
});
it("QA preset uses the existing private-draft price/title validation", () => {
  expect(productTitle.parse(creatorQaDraft.title)).toBe(creatorQaDraft.title);
  expect(productDescription.parse(creatorQaDraft.description)).toBe(creatorQaDraft.description);
  expect(productPrice.parse(creatorQaDraft.price)).toBe(50);
});
it("expired enabled offers are reported as unavailable, and pending reviews as unpublished", () => {
  const now = Date.parse("2026-11-21T12:00:00Z");
  expect(creatorOfferStatus({enabled:true,reviewExpiresAt:"2026-11-20T00:00:00Z"},now)).toBe("Review expired — not available for purchase");
  expect(creatorOfferStatus({enabled:false,reviewExpiresAt:"2026-11-20T00:00:00Z"},now)).toBe("Review expired — not available for purchase");
  expect(creatorOfferStatus({enabled:true,reviewExpiresAt:"2026-11-22T00:00:00Z"},now)).toBe("Published for sandbox testing");
  expect(creatorOfferStatus({enabled:false,reviewExpiresAt:"2026-11-22T00:00:00Z"},now)).toBe("Reviewed — not published");
});

it("uses a separate discount-compatible draft, not a changed historical preset", () => {
  expect(productPrice.parse(creatorDiscountQaDraft.price)).toBe(200);
  expect(productTitle.parse(creatorDiscountQaDraft.title)).toBe(creatorDiscountQaDraft.title);
  expect(productDescription.parse(creatorDiscountQaDraft.description)).toBe(creatorDiscountQaDraft.description);
  expect(productPrice.parse(creatorQaDraft.price)).toBe(50);
  expect(creatorDiscountQaDraft.title).not.toBe(creatorQaDraft.title);
});
