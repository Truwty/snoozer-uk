import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { defaultAppearance, profileAppearance } from "../src/lib/profile";

const migration = readFileSync(
  new URL("../supabase/migrations/20261127010003_custom_cursor_appearance.sql", import.meta.url),
  "utf8",
);

describe("custom cursor appearance persistence", () => {
  it("accepts a UUID custom cursor image and rejects invalid references", () => {
    const cursorId = "00000000-0000-4000-8000-000000000031";

    expect(profileAppearance.safeParse({ ...defaultAppearance, customCursorImage: cursorId }).success).toBe(true);
    expect(profileAppearance.safeParse({ ...defaultAppearance, customCursorImage: "not-a-uuid" }).success).toBe(false);
  });

  it("keeps the database allow-list and UUID validation in sync with the editor schema", () => {
    expect(migration).toContain("'backgroundVideo','customCursorImage'");
    expect(migration).toContain("p_value->'customCursorImage' is null");
    expect(migration).toContain("lower(p_value->>'customCursorImage')");
    expect(migration).toContain("~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'");
  });
});
