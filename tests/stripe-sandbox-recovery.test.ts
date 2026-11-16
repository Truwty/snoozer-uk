import { describe, expect, it, vi } from "vitest";
import { recoverStripeSandboxEvent } from "../src/lib/stripe-sandbox-recovery";

const token = "local-test-" + "a".repeat(24);
const event = {
  id: "evt_Missed", object: "event", type: "invoice.paid", created: 1760000000, livemode: false,
  data: { object: { id: "in_Paid" } },
};

function request(body = JSON.stringify({ id: event.id }), authorization = "Bearer " + token) {
  return new Request("https://example.com/api/v1/billing/stripe/recover", {
    method: "POST", body, headers: { authorization },
  });
}

describe("Stripe sandbox event recovery", () => {
  it("retrieves the provider event rather than trusting a caller-supplied event body", async () => {
    const retrieve = vi.fn().mockResolvedValue(event);
    const process = vi.fn();
    const response = await recoverStripeSandboxEvent(
      request(JSON.stringify({ id: event.id, type: "invoice.payment_failed" })), token, retrieve, process,
    );
    expect(response.status).toBe(204);
    expect(retrieve).toHaveBeenCalledExactlyOnceWith(event.id);
    expect(process).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ type: "invoice.paid", objectId: "in_Paid" }));
  });

  it("blocks unauthorised and malformed calls before contacting Stripe", async () => {
    const retrieve = vi.fn();
    const process = vi.fn();
    expect((await recoverStripeSandboxEvent(request("{}", "Bearer wrong"), token, retrieve, process)).status).toBe(401);
    expect((await recoverStripeSandboxEvent(request("{}"), token, retrieve, process)).status).toBe(400);
    expect((await recoverStripeSandboxEvent(request("x".repeat(1025)), token, retrieve, process)).status).toBe(413);
    expect(retrieve).not.toHaveBeenCalled();
  });

  it("rejects mismatched and live events and reports a failed processing attempt", async () => {
    const retrieve = vi.fn().mockResolvedValueOnce({ ...event, id: "evt_Other" })
      .mockResolvedValueOnce({ ...event, livemode: true }).mockResolvedValueOnce(event);
    const process = vi.fn().mockRejectedValue(new Error("temporary failure"));
    expect((await recoverStripeSandboxEvent(request(), token, retrieve, process)).status).toBe(422);
    expect((await recoverStripeSandboxEvent(request(), token, retrieve, process)).status).toBe(503);
    expect(process).not.toHaveBeenCalled();
    expect((await recoverStripeSandboxEvent(request(), token, retrieve, process)).status).toBe(503);
    expect(process).toHaveBeenCalledTimes(1);
  });
});
