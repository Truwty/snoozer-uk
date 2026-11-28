import { describe, expect, it } from "vitest";
import { makeProfileBlock, profileBlock, profileBlocks, type ProfileBlock } from "../src/lib/profile-blocks";

describe("custom profile blocks", () => {
  it("creates every supported block with safe defaults", () => {
    const kinds: ProfileBlock["type"][] = [
      "heading", "about", "callout", "quote", "project",
      "skills", "cta", "divider", "countdown", "stats",
    ];
    const blocks = kinds.map((kind) => makeProfileBlock(kind));
    expect(profileBlocks.parse(blocks)).toHaveLength(kinds.length);
    expect(new Set(blocks.map((block) => block.id)).size).toBe(kinds.length);
    expect(blocks.every((block) => block.hidden && !block.locked && block.width === "full")).toBe(true);
  });

  it("enforces bounded heading, paragraph and list content", () => {
    const heading = makeProfileBlock("heading");
    expect(profileBlock.safeParse({ ...heading, text: "A profile heading" }).success).toBe(true);
    expect(profileBlock.safeParse({ ...heading, text: " " }).success).toBe(false);
    expect(profileBlock.safeParse({ ...heading, text: "x".repeat(161) }).success).toBe(false);
    const skills = makeProfileBlock("skills");
    expect(profileBlock.safeParse({ ...skills, items: ["TypeScript", "Roblox Lua"] }).success).toBe(true);
    expect(profileBlock.safeParse({ ...skills, items: [] }).success).toBe(false);
    expect(profileBlock.safeParse({ ...skills, items: [""] }).success).toBe(false);
  });

  it("rejects executable targets, unknown fields and unsupported styles", () => {
    const project = makeProfileBlock("project");
    expect(profileBlock.safeParse({ ...project, url: "https://portfolio.example.org/project" }).success).toBe(true);
    expect(profileBlock.safeParse({ ...project, url: "javascript:alert(1)" }).success).toBe(false);
    expect(profileBlock.safeParse({ ...project, extraCss: "display:none" }).success).toBe(false);
    expect(profileBlock.safeParse({ ...project, variant: "raw-html" }).success).toBe(false);
    const cta = makeProfileBlock("cta");
    expect(profileBlock.safeParse({ ...cta, url: "https://example.com/contact" }).success).toBe(true);
    expect(profileBlock.safeParse({ ...cta, url: "https://localhost/" }).success).toBe(false);
  });

  it("retains visibility, lock and presentation controls in the schema", () => {
    const block = makeProfileBlock("about");
    expect(profileBlock.parse({ ...block, hidden: true, locked: true, width: "half", align: "center", variant: "outline" }))
      .toMatchObject({ hidden: true, locked: true, width: "half", align: "center", variant: "outline" });
  });

  it("rejects duplicate block ids and blocks beyond the page limit", () => {
    const block = makeProfileBlock("heading");
    expect(profileBlocks.safeParse([block, { ...block, type: "about", heading: "About", body: "Details" }]).success).toBe(false);
    expect(profileBlocks.safeParse(Array.from({ length: 33 }, () => makeProfileBlock("heading"))).success).toBe(false);
  });
});
