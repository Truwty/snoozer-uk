import { describe, expect, it } from "vitest";
import { isMaintenanceExempt } from "./maintenance-routes";
import {
  stateFromProviderIndicator,
  summarisePublicStatus,
  type PublicServiceState,
} from "./public-status";

describe("public status mapping", () => {
  it.each([
    ["none", "operational"],
    ["minor", "degraded"],
    ["major", "outage"],
    ["critical", "outage"],
    ["maintenance", "maintenance"],
    ["unknown", "unknown"],
  ] as const)("maps provider indicator %s to %s", (indicator, expected) => {
    expect(stateFromProviderIndicator(indicator)).toBe(expected);
  });

  it("does not label unavailable monitoring as operational", () => {
    const summary = summarisePublicStatus([{ state: "unknown" }]);
    expect(summary.state).toBe("unknown");
    expect(summary.title).toContain("can’t verify");
  });

  it("prioritises a failing Snoozer readiness check", () => {
    const summary = summarisePublicStatus([
      { state: "operational" },
      { state: "outage" },
    ]);
    expect(summary.state).toBe("outage");
  });

  it("surfaces an open scheduled-monitor incident", () => {
    const states: PublicServiceState[] = ["operational", "operational"];
    const summary = summarisePublicStatus(states.map((state) => ({ state })), true);
    expect(summary.state).toBe("degraded");
    expect(summary.label).toBe("ACTIVE INCIDENT");
  });

  it("keeps the public status page available during maintenance mode", () => {
    expect(isMaintenanceExempt("/status", "GET")).toBe(true);
    expect(isMaintenanceExempt("/status", "HEAD")).toBe(true);
  });
});
