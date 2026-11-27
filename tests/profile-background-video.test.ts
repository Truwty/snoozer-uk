import { describe, expect, it } from "vitest";
import {
  profileBackgroundVideoExtension, profileBackgroundVideoMaxBytes,
  validProfileBackgroundVideoBytes,
} from "../src/lib/profile-background-video";

describe("profile background video uploads", () => {
  it("allows only MP4 and WebM content types", () => {
    expect(profileBackgroundVideoExtension("video/mp4")).toBe("mp4");
    expect(profileBackgroundVideoExtension("video/webm")).toBe("webm");
    expect(profileBackgroundVideoExtension("video/quicktime")).toBeNull();
    expect(profileBackgroundVideoExtension("application/octet-stream")).toBeNull();
  });

  it("checks MP4 and WebM container signatures rather than trusting the file name", () => {
    const mp4 = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0]);
    const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x93, 0x42, 0x82, 0x88, 0x77, 0x65, 0x62, 0x6d, 0]);
    expect(validProfileBackgroundVideoBytes(mp4, "mp4")).toBe(true);
    expect(validProfileBackgroundVideoBytes(webm, "webm")).toBe(true);
    expect(validProfileBackgroundVideoBytes(webm, "mp4")).toBe(false);
    expect(validProfileBackgroundVideoBytes(mp4, "webm")).toBe(false);
    expect(validProfileBackgroundVideoBytes(new Uint8Array(11), "mp4")).toBe(false);
  });

  it("caps profile background videos at 50 MB", () => {
    expect(profileBackgroundVideoMaxBytes).toBe(50 * 1024 * 1024);
    expect(validProfileBackgroundVideoBytes(new Uint8Array(12), "mp4")).toBe(false);
  });
});
