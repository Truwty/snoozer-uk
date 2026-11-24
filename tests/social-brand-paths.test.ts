import { describe, expect, it } from "vitest";
import { socialBrandPaths } from "../src/lib/social-brand-paths";
import { socialProviders } from "../src/lib/social-providers";

describe("social brand icons", () => {
  it("bundles a vector mark for every supported social provider", () => {
    for (const provider of socialProviders) {
      const paths = socialBrandPaths[provider.id];
      expect(paths, `Missing icon paths for ${provider.id}`).toBeDefined();
      expect(paths?.length, `Missing SVG path data for ${provider.id}`).toBeGreaterThan(0);
      expect(paths?.every((path) => path.trim().length > 0), `Empty SVG path for ${provider.id}`).toBe(true);
    }
  });

  it("does not use the old two-letter initials as icon artwork", () => {
    expect(socialBrandPaths.instagram).toBeDefined();
    expect(socialBrandPaths.tiktok).toBeDefined();
    expect(socialBrandPaths.youtube).toBeDefined();
    expect(socialBrandPaths.discord).toBeDefined();
    for (const providerId of ["instagram", "tiktok", "youtube", "discord"] as const) {
      expect(socialBrandPaths[providerId]?.[0]).not.toMatch(/^(IG|TT|YT|DC)$/);
    }
  });
});
