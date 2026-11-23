import { describe, expect, it } from "vitest";
import { defaultProfileWidgets, profileWidgets } from "../src/lib/profile-widgets";

describe("interactive profile widgets", () => {
  it("accepts the default disabled widget configuration", () => {
    expect(profileWidgets.parse(defaultProfileWidgets)).toEqual(defaultProfileWidgets);
  });
  it("requires four unique ordering positions", () => {
    expect(profileWidgets.safeParse({ ...defaultProfileWidgets, order: ["faq", "faq", "poll", "guestbook"] }).success).toBe(false);
  });
  it("requires populated testimonials and FAQs before enabling them", () => {
    expect(profileWidgets.safeParse({ ...defaultProfileWidgets, testimonials: { ...defaultProfileWidgets.testimonials, enabled: true } }).success).toBe(false);
    expect(profileWidgets.safeParse({ ...defaultProfileWidgets, faq: { ...defaultProfileWidgets.faq, enabled: true } }).success).toBe(false);
  });
  it("validates poll choices and rejects duplicate options", () => {
    const valid = { ...defaultProfileWidgets, poll: {
      ...defaultProfileWidgets.poll, enabled: true, question: "Which widget should we add next?",
      options: [
        { id: "00000000-0000-4000-8000-000000000002", label: "Guestbook" },
        { id: "00000000-0000-4000-8000-000000000003", label: "Polls" },
      ],
    } };
    expect(profileWidgets.safeParse(valid).success).toBe(true);
    expect(profileWidgets.safeParse({ ...valid, poll: { ...valid.poll, options: [
      ...valid.poll.options, { id: "00000000-0000-4000-8000-000000000004", label: " guestbook " },
    ] } }).success).toBe(false);
  });
  it("rejects overlong FAQ content and unknown keys", () => {
    const invalid = { ...defaultProfileWidgets, faq: { enabled: true, heading: "Questions", items: [{
      id: "00000000-0000-4000-8000-000000000005", question: "Q".repeat(121), answer: "A",
    }] } };
    expect(profileWidgets.safeParse(invalid).success).toBe(false);
    expect(profileWidgets.safeParse({ ...defaultProfileWidgets, executable: "javascript:alert(1)" }).success).toBe(false);
  });
});
