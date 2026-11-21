import { describe, expect, it } from "vitest";
import { purchaseSupportGuidance, purchaseSupportHref } from "../src/lib/creator-purchase-support";

describe("sandbox buyer support guidance", () => {
  it("uses the established support mailbox rather than a missing home anchor", () => {
    expect(purchaseSupportHref).toBe("mailto:SnoozerSupport@Snoozer.uk");
    expect(purchaseSupportHref).not.toBe("/#contact");
  });
  it("prioritises active risk holds even for paid purchases", () => {
    const result = purchaseSupportGuidance({ state: "paid", held: true, accessActive: false });
    expect(result.heading).toBe("Delivery on hold");
    expect(result.guidance).toContain("will not remove an active hold");
    expect(result.guidance).not.toContain("download PDF");
  });
  it("warns pending buyers not to retry payments prematurely", () => {
    const result = purchaseSupportGuidance({state:"pending",held:false,accessActive:false});
    expect(result.heading).toBe("Payment verification pending");
    expect(result.guidance).toContain("Do not pay again");
  });
  it("does not claim that expired checkout grants access", () => {
    const result = purchaseSupportGuidance({state:"expired",held:false,accessActive:false});
    expect(result.heading).toBe("Checkout not completed");
    expect(result.guidance).toContain("does not grant a download");
  });
  it("does not promise access when a paid order is no longer active", () => {
    const result = purchaseSupportGuidance({state:"paid",held:false,accessActive:false});
    expect(result.heading).toBe("Download not currently available");
    expect(result.guidance).toContain("cannot be extended automatically");
  });
  it("allows guidance for active access but still requires verification", () => {
    const result = purchaseSupportGuidance({state:"paid",held:false,accessActive:true});
    expect(result.heading).toBe("Download available");
    expect(result.guidance).toContain("still checks the current payment");
  });
  it("never claims a held order is downloadable even if stale accessActive says true", () => {
    expect(purchaseSupportGuidance({state:"paid",held:true,accessActive:true}).heading).toBe("Delivery on hold");
  });
});
