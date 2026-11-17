import { describe, expect, it, vi } from "vitest";
import { receiveKofiWebhook } from "../src/lib/kofi-webhook";

const token = "test-only-token";
const donation = {
  verification_token: token, type: "Donation", message_id: "6310f878-068b-4aaf-9b34-4a82f9787ef3",
  kofi_transaction_id: "test-transaction", timestamp: "2026-11-16T12:00:00Z", amount: "3.50", currency: "GBP",
  is_public: false, email: "anonymous@example.com", from_name: "Private", message: "Private note",
};
const request = (body: Record<string, unknown>) =>
  new Request("https://example.com/api/v1/billing/kofi/webhook", {
    method: "POST", body: new URLSearchParams({ data: JSON.stringify(body) }),
  });

describe("Ko-fi donation intake", () => {
  it("persists only the receipt fields for an anonymous donation and retries storage failure", async () => {
    const record = vi.fn().mockRejectedValueOnce(new Error("database unavailable")).mockResolvedValue(undefined);
    expect((await receiveKofiWebhook(request(donation), token, record)).status).toBe(503);
    expect((await receiveKofiWebhook(request(donation), token, record)).status).toBe(200);
    expect(record).toHaveBeenLastCalledWith({
      id: donation.message_id, transactionId: donation.kofi_transaction_id,
      occurredAt: donation.timestamp, amount: 350, currency: "GBP",
    });
  });

  it("records USD tips in cents with the original currency", async () => {
    const record = vi.fn();
    expect((await receiveKofiWebhook(request({ ...donation, currency: "USD" }), token, record)).status).toBe(200);
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ amount: 350, currency: "USD" }));
  });

  it.each([
    [{ verification_token: "wrong" }, 401],
    [{ type: "Subscription" }, 200],
    [{ amount: "0.00" }, 400],
    [{ amount: "3.501" }, 400],
    [{ currency: "EUR" }, 400],
    [{ message_id: "invalid" }, 400],
  ])("handles a changed payload without storing a donation", async (change, status) => {
    const record = vi.fn();
    expect((await receiveKofiWebhook(request({ ...donation, ...change }), token, record)).status).toBe(status);
    expect(record).not.toHaveBeenCalled();
  });
});
