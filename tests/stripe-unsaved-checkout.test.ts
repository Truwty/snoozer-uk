import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { recoverUnsavedSandboxCheckout } from "../src/lib/stripe-unsaved-checkout";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase", () => ({ storageAdmin: () => ({ rpc }) }));

const owner = "00000000-0000-4000-8000-000000000001";
const attempt = { id: "00000000-0000-4000-8000-000000000002", customer_id: "cus_Mapped", created_epoch: 100000, expires_epoch: 107200 };
const session = {
  id: "cs_test_Original", customer: attempt.customer_id, client_reference_id: owner,
  expires_at: attempt.expires_epoch, livemode: false, mode: "subscription", status: "complete", subscription: "sub_Original",
};

function setup(sessions: unknown[]) {
  rpc.mockReset().mockReturnValueOnce({ maybeSingle: async () => ({ data: attempt, error: null }) })
    .mockResolvedValueOnce({ data: true, error: null });
  const list = vi.fn().mockReturnValue(sessions);
  return { checkout: { sessions: { list } } } as unknown as Stripe;
}

describe("unsaved Stripe Checkout recovery", () => {
  it("recovers a completed matching session without retiring it", async () => {
    const stripe = setup([{ ...session, client_reference_id: "other" }, session]);
    await expect(recoverUnsavedSandboxCheckout(stripe, owner)).resolves.toBe("complete");
    expect(rpc).toHaveBeenLastCalledWith("bind_stripe_sandbox_checkout", {
      p_owner: owner, p_attempt: attempt.id, p_customer: attempt.customer_id, p_session: session.id,
    });
  });

  it("retires a confirmed expired match and preserves the old session ID", async () => {
    const stripe = setup([{ ...session, status: "expired", subscription: null }]);
    await expect(recoverUnsavedSandboxCheckout(stripe, owner)).resolves.toBe("retired");
    expect(rpc).toHaveBeenLastCalledWith("retire_unsaved_stripe_sandbox_checkout", {
      p_owner: owner, p_attempt: attempt.id, p_customer: attempt.customer_id, p_expired_session: session.id,
    });
  });

  it("retires an empty search and refuses ambiguous matches", async () => {
    const empty = setup([]);
    await expect(recoverUnsavedSandboxCheckout(empty, owner)).resolves.toBe("retired");
    expect(rpc).toHaveBeenLastCalledWith("retire_unsaved_stripe_sandbox_checkout",
      expect.objectContaining({ p_expired_session: null }));
    const ambiguous = setup([session, { ...session, id: "cs_test_Other" }]);
    await expect(recoverUnsavedSandboxCheckout(ambiguous, owner)).rejects.toThrow("Ambiguous");
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
