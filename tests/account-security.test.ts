import { describe, expect, it } from "vitest";
import { deviceLabel, safeNextPath } from "@/lib/account-security";

describe("safeNextPath", () => {
  it("allows same-site paths, query strings and fragments", () => {
    expect(safeNextPath("/studio/account?email=changed")).toBe("/studio/account?email=changed");
    expect(safeNextPath("/gift#private-token")).toBe("/gift#private-token");
  });
  it("rejects external and protocol-relative redirects", () => {
    expect(safeNextPath("https://evil.example")).toBe("/studio");
    expect(safeNextPath("//evil.example/path")).toBe("/studio");
  });
  it("rejects backslash and control-character redirects", () => {
    expect(safeNextPath("/\\evil.example")).toBe("/studio");
    expect(safeNextPath("/studio\r\nLocation:https://evil.example")).toBe("/studio");
  });
  it("rejects overlong redirects and non-string values", () => {
    expect(safeNextPath("/" + "a".repeat(301))).toBe("/studio");
    expect(safeNextPath(null)).toBe("/studio");
  });
});

describe("deviceLabel", () => {
  it("detects Edge on Windows", () => {
    expect(deviceLabel("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Edg/124.0")).toBe("Edge · Windows");
  });
  it("detects Firefox on macOS", () => {
    expect(deviceLabel("Mozilla/5.0 (Macintosh; Intel Mac OS X 14.0) Firefox/122.0")).toBe("Firefox · macOS");
  });
  it("detects Opera before the Chromium token", () => {
    expect(deviceLabel("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 OPR/106.0")).toBe("Opera · Linux");
  });
  it("handles unknown user agents safely", () => {
    expect(deviceLabel(null)).toBe("Unknown browser · Unknown device");
  });
});
