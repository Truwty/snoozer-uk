import { describe, expect, it } from "vitest";
import { normalizeProfileLinks } from "../src/lib/profile-links";

describe("normalizeProfileLinks", () => {
  it("preserves valid same-origin uploaded audio paths", () => {
    const path = "/media/audio/22222222-2222-4222-8222-222222222222.mp3";
    expect(normalizeProfileLinks([
      { label: "Uploaded audio", url: path, mode: "text" },
    ])).toEqual([
      { label: "Uploaded audio", url: path, mode: "text", hidden: false },
    ]);
  });

  it("normalises URLs and defaults link visibility without dropping optional presentation fields", () => {
    const iconId = "11111111-1111-4111-8111-111111111111";
    const audioCoverId = "22222222-2222-4222-8222-222222222222";

    expect(normalizeProfileLinks([
      { label: "Ko-fi", url: "https://www.ko-fi.com/creator/", hidden: false },
      { label: "Text link", url: "https://github.com/example", mode: "text" },
      { label: "Custom icon", url: "https://example.org", iconImage: iconId },
      { label: "Audio", url: "https://cdn.example.org/track.mp3", audioCoverImage: audioCoverId, hidden: true },
    ])).toEqual([
      { label: "Ko-fi", url: "https://www.ko-fi.com/creator/", hidden: false },
      { label: "Text link", url: "https://github.com/example", mode: "text", hidden: false },
      { label: "Custom icon", url: "https://example.org/", iconImage: iconId, hidden: false },
      { label: "Audio", url: "https://cdn.example.org/track.mp3", audioCoverImage: audioCoverId, hidden: true },
    ]);
  });
});
