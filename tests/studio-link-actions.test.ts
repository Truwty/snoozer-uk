import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const editor = readFileSync(new URL("../src/components/editor.tsx", import.meta.url), "utf8");
const globalStyles = readFileSync(new URL("../src/app/styles.css", import.meta.url), "utf8");
const studioStyles = readFileSync(new URL("../src/app/studio/studio-video-screens.css", import.meta.url), "utf8");

describe("Studio link row actions", () => {
  it("keeps reorder and remove controls persistently available on every link row", () => {
    expect(editor).toContain('className="studio-link-actions"');
    expect(editor).toContain('aria-label={`Remove link ${index + 1}`}');
    expect(editor).toContain(">Remove</button>");
    expect(editor).toContain("Move up");
    expect(editor).toContain("Move down");
    expect(editor).not.toContain('className="row-menu"');
  });

  it("keeps action controls in normal flow instead of a popover that can be clipped", () => {
    expect(studioStyles).toContain(".studio-main-content .link-editor.link-row > .studio-link-actions");
    expect(studioStyles).toContain(".studio-main-content .studio-link-actions {");
    expect(studioStyles).toContain("flex-wrap:wrap");
    expect(globalStyles).not.toContain(".row-menu > .actions");
  });
});
