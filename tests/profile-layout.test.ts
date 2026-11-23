import { describe, expect, it } from "vitest";
import {
  moveProfilePageElement,
  normalizeProfilePageLayout,
  profilePageLayout,
  remapProfileSectionPositions,
  type ProfileLayoutContent,
} from "../src/lib/profile-layout";

function content(overrides: Partial<ProfileLayoutContent> = {}): ProfileLayoutContent {
  return {
    sections: [{ id: "one" }, { id: "two" }],
    links: [{ label: "Website" }],
    widgets: {
      guestbook: { enabled: false },
      testimonials: { enabled: false },
      poll: { enabled: true },
      faq: { enabled: true },
    },
    gallery: [{ id: "image-one" }],
    ...overrides,
  };
}

describe("profile page layout", () => {
  it("converts an empty legacy layout into the existing profile's full default order", () => {
    expect(normalizeProfilePageLayout({ version: 1, items: [] }, content()).items).toEqual([
      { type: "section", index: 0 },
      { type: "section", index: 1 },
      { type: "links" },
      { type: "widgets" },
      { type: "gallery" },
    ]);
  });

  it("moves sections, links, widgets and gallery across category boundaries", () => {
    const current = normalizeProfilePageLayout(undefined, content());
    const moved = moveProfilePageElement(current, 3, 0, content());
    expect(moved.items).toEqual([
      { type: "widgets" },
      { type: "section", index: 0 },
      { type: "section", index: 1 },
      { type: "links" },
      { type: "gallery" },
    ]);
  });

  it("keeps section identities mapped correctly when the section editor reorders them", () => {
    const first = { id: "first" };
    const second = { id: "second" };
    const previous = [first, second];
    const initial = normalizeProfilePageLayout(undefined, content({ sections: previous }));
    const reordered = remapProfileSectionPositions(initial, previous, [second, first], content({ sections: [second, first] }));
    expect(reordered.items.slice(0, 2)).toEqual([
      { type: "section", index: 1 },
      { type: "section", index: 0 },
    ]);
  });

  it("removes deleted sections but preserves the other element positions", () => {
    const first = { id: "first" };
    const second = { id: "second" };
    const previous = [first, second];
    const initial = normalizeProfilePageLayout(undefined, content({ sections: previous }));
    const trimmed = remapProfileSectionPositions(initial, previous, [second], content({ sections: [second] }));
    expect(trimmed.items).toEqual([
      { type: "section", index: 0 },
      { type: "links" },
      { type: "widgets" },
      { type: "gallery" },
    ]);
  });

  it("rejects duplicate, unknown and out-of-range layout references", () => {
    expect(profilePageLayout.safeParse({
      version: 1,
      items: [{ type: "links" }, { type: "links" }],
    }).success).toBe(false);
    expect(profilePageLayout.safeParse({
      version: 1,
      items: [{ type: "iframe", url: "javascript:alert(1)" }],
    }).success).toBe(false);
    const withStaleIndex = normalizeProfilePageLayout({
      version: 1,
      items: [{ type: "section", index: 5 }, { type: "links" }],
    }, content({ sections: [{ id: "only" }] }));
    expect(withStaleIndex.items).toEqual([
      { type: "links" },
      { type: "section", index: 0 },
      { type: "widgets" },
      { type: "gallery" },
    ]);
  });
});
