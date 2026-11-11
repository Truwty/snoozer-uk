import { expect, it } from "vitest";
import { countdownDate, countdownRemaining, countdownTarget } from "../src/lib/countdown";

it("accepts real UTC minutes and rejects normalised or offset dates", () => {
  const leap = countdownTarget("2028-02-29T18:15");
  expect(leap?.toISOString()).toBe("2028-02-29T18:15:00.000Z");
  expect(countdownDate(leap!)).toContain("18:15 UTC");
  for (const bad of ["2027-02-29T18:15", "2028-02-29T24:00", "0000-01-01T00:00", "2028-02-29T18:15Z"]) {
    expect(countdownTarget(bad)).toBeNull();
  }
});

it("rounds up to the next minute and stops updating at expiry", () => {
  const target = 100_000_000;
  expect(countdownRemaining(target, target - 90_000)).toEqual({ label: "2 minutes remaining", nextUpdate: 30_000 });
  expect(countdownRemaining(target, target - 1)).toEqual({ label: "1 minute remaining", nextUpdate: 1 });
  expect(countdownRemaining(target, target)).toEqual({ label: "Countdown finished.", nextUpdate: null });
  expect(countdownRemaining(target, target + 1)).toEqual(countdownRemaining(target, target));
});
